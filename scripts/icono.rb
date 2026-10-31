#!/usr/bin/ruby
# encoding: utf-8
# Genera los íconos PNG (una dona sobre fondo azul) sin dependencias.
# Uso:  ruby scripts/icono.rb

require 'zlib'

FONDO = [31, 102, 189].freeze
ANILLO = [255, 255, 255].freeze
TRAMO = [255, 176, 120].freeze
ARCO_TRAMO = 0.30 # fracción del anillo en el segundo color

def chunk(tipo, datos)
  [datos.bytesize].pack('N') + tipo + datos + [Zlib.crc32(tipo + datos)].pack('N')
end

def mezclar(a, b, t)
  a.zip(b).map { |x, y| (x + (y - x) * t).round }
end

def icono(lado)
  c = lado / 2.0
  exterior = lado * 0.33
  interior = lado * 0.205
  filas = (0...lado).map do |y|
    fila = "\0".b
    (0...lado).each do |x|
      dx = x + 0.5 - c
      dy = y + 0.5 - c
      r = Math.sqrt(dx * dx + dy * dy)
      # Cobertura con 1px de suavizado en ambos bordes del anillo.
      cobertura = [[exterior - r + 0.5, 1].min, [r - interior + 0.5, 1].min].min.clamp(0, 1)
      angulo = (Math.atan2(dx, -dy) / (2 * Math::PI)) % 1 # 0 arriba, sentido horario
      color = angulo < ARCO_TRAMO ? TRAMO : ANILLO
      fila << mezclar(FONDO, color, cobertura).pack('C3')
    end
    fila
  end
  "\x89PNG\r\n\x1a\n".b +
    chunk('IHDR', [lado, lado, 8, 2, 0, 0, 0].pack('NNCCCCC')) +
    chunk('IDAT', Zlib.deflate(filas.join)) +
    chunk('IEND', ''.b)
end

{ 'icons/icon-180.png' => 180, 'icons/icon-192.png' => 192, 'icons/icon-512.png' => 512 }.each do |ruta, lado|
  File.binwrite(ruta, icono(lado))
end
