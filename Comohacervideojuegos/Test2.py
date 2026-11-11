import pygame
pos_jugador = pygame.Vector2(100, 200)
# FORMA INCORRECTA (Ambas variables apuntan al mismo objeto en memoria):
pos_bala_mal = pos_jugador
pos_bala_mal.x += 300 # ¡ERROR! Ahora pos_jugador.x también vale 400.
# FORMA CORRECTA (Creamos un clon independiente con .copy()):
pos_jugador = pygame.Vector2(100, 200)
pos_bala_bien = pos_jugador.copy()
pos_bala_bien.x += 300 # pos_bala_bien.x vale 400, y pos_jugador.x sigue valiendo 100.