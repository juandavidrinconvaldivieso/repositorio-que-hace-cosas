"""Firmas XEdDSA: firmar con la misma clave X25519 que define el código WIND de cada persona.

Así una publicación en un foro se puede verificar contra el código de su autor sin claves extra.
Basado en la especificación XEdDSA de Signal (https://signal.org/docs/specifications/xeddsa/).
"""
import hashlib
import os

from nacl.bindings import crypto_scalarmult_ed25519_base_noclamp
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

P = 2 ** 255 - 19
Q = 2 ** 252 + 27742317777372353535851937790883648493


def _clamp(k: bytes) -> int:
    b = bytearray(k)
    b[0] &= 248
    b[31] &= 127
    b[31] |= 64
    return int.from_bytes(b, "little")


def _h(*parts: bytes) -> int:
    return int.from_bytes(hashlib.sha512(b"".join(parts)).digest(), "little") % Q


def sign(x25519_sk: bytes, msg: bytes) -> bytes:
    a = _clamp(x25519_sk) % Q
    A = bytearray(crypto_scalarmult_ed25519_base_noclamp(a.to_bytes(32, "little")))
    if A[31] & 0x80:  # forzamos signo 0, como hace la conversión desde Montgomery
        a = (Q - a) % Q
        A[31] &= 0x7F
    ab = a.to_bytes(32, "little")
    r = _h(b"\xfe" + b"\xff" * 31, ab, msg, os.urandom(64))
    R = crypto_scalarmult_ed25519_base_noclamp(r.to_bytes(32, "little"))
    s = (r + _h(R, bytes(A), msg) * a) % Q
    return R + s.to_bytes(32, "little")


def verify(x25519_pk: bytes, msg: bytes, sig: bytes) -> bool:
    u = int.from_bytes(x25519_pk, "little") % P
    if u == P - 1:
        return False
    y = (u - 1) * pow(u + 1, P - 2, P) % P
    try:
        VerifyKey(y.to_bytes(32, "little")).verify(msg, sig)
        return True
    except (BadSignatureError, ValueError):
        return False
