from krita import Krita
from .kra2animate import Kra2Animate

Krita.instance().addExtension(Kra2Animate(Krita.instance()))
