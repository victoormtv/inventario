-- ─────────────────────────────────────────────
-- PRODUCTOS
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO productos (sku, nombre, categoria, precio_costo, precio_venta, stock_minimo) VALUES
  ('PEG-CAS',  'Pegamento Casacor',                    'Pegamentos',  0, 0, 5),
  ('PEG-TRE',  'Pegamento Trébol',                     'Pegamentos',  0, 0, 5),
  ('FRA-CAS',  'Fragua Casacor',                       'Fraguas',     0, 0, 5),
  ('CRU-3X3',  'Crucetas 3x3 (100und)',                'Accesorios',  0, 0, 2),
  ('CRU-2X2',  'Crucetas 2x2 (100und)',                'Accesorios',  0, 0, 2),
  ('CRU-1X1',  'Crucetas 1x1 (100und)',                'Accesorios',  0, 0, 2),
  ('NIV-POR',  'Sistema de nivelación para porcelanato','Accesorios', 0, 0, 2);

-- ─────────────────────────────────────────────
-- VARIANTES  (talla=Única cuando no aplica)
-- color      = color real del producto
-- detalle    = característica adicional (Flexible, Extrafuerte, Interiores…)
-- kg / lote  = vacíos por ahora, completa según tus lotes reales
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO variantes (sku_producto, color, detalle, talla, stock_actual, id_sucursal) VALUES
  -- Pegamento Casacor
  ('PEG-CAS', 'Blanco', 'Flexible',    'Única', 299, 1),
  ('PEG-CAS', 'Gris',   'Interiores',  'Única', 255, 1),

  -- Pegamento Trébol
  ('PEG-TRE', 'Blanco', 'Extrafuerte', 'Única', 153, 1),
  ('PEG-TRE', 'Gris',   'Interiores',  'Única', 101, 1),

  -- Fragua Casacor (color = el color de fragua, sin detalle extra)
  ('FRA-CAS', 'Madera',        NULL, 'Única',  32, 1),
  ('FRA-CAS', 'Cuero',         NULL, 'Única',  50, 1),
  ('FRA-CAS', 'Gris',          NULL, 'Única',  72, 1),
  ('FRA-CAS', 'Grafito',       NULL, 'Única',  42, 1),
  ('FRA-CAS', 'Gris Plata',    NULL, 'Única',  82, 1),
  ('FRA-CAS', 'Mármol',        NULL, 'Única',  49, 1),
  ('FRA-CAS', 'Marfil',        NULL, 'Única',  22, 1),
  ('FRA-CAS', 'Marrón Claro',  NULL, 'Única',  24, 1),
  ('FRA-CAS', 'Beige',         NULL, 'Única',  22, 1),
  ('FRA-CAS', 'Marrón Oscuro', NULL, 'Única',  42, 1),
  ('FRA-CAS', 'Crema',         NULL, 'Única',  45, 1),
  ('FRA-CAS', 'Rojo',          NULL, 'Única',   8, 1),
  ('FRA-CAS', 'Azul Pastel',   NULL, 'Única',   7, 1),
  ('FRA-CAS', 'Chocolate',     NULL, 'Única',  50, 1),
  ('FRA-CAS', 'Guinda',        NULL, 'Única',  19, 1),
  ('FRA-CAS', 'Negro',         NULL, 'Única',  11, 1),
  ('FRA-CAS', 'Arena',         NULL, 'Única',  20, 1),
  ('FRA-CAS', 'Verde Flora',   NULL, 'Única',  25, 1),
  ('FRA-CAS', 'Hueso',         NULL, 'Única',  29, 1),
  ('FRA-CAS', 'Blanco',        NULL, 'Única',  94, 1),
  ('FRA-CAS', 'Turquesa',      NULL, 'Única',  25, 1),
  ('FRA-CAS', 'Crepúsculo',    NULL, 'Única',   7, 1),

  -- Crucetas
  ('CRU-3X3', 'Único', NULL, '3x3', 7, 1),
  ('CRU-2X2', 'Único', NULL, '2x2', 2, 1),
  ('CRU-1X1', 'Único', NULL, '1x1', 2, 1),

  -- Sistema de nivelación
  ('NIV-POR', 'Único', NULL, 'Única', 2, 1);

-- ─────────────────────────────────────────────
-- KARDEX inicial (ENTRADA por inventario inicial)
-- Se registra un movimiento por cada variante
-- ─────────────────────────────────────────────
INSERT INTO kardex (sku_producto, id_variante, tipo_movimiento, cantidad, stock_anterior, stock_resultante, referencia, usuario, id_sucursal)
SELECT
  v.sku_producto,
  v.id,
  'ENTRADA',
  v.stock_actual,
  0,
  v.stock_actual,
  'Inventario inicial 21/09',
  'admin',
  1
FROM variantes v
WHERE v.sku_producto IN ('PEG-CAS','PEG-TRE','FRA-CAS','CRU-3X3','CRU-2X2','CRU-1X1','NIV-POR')
  AND v.stock_actual > 0;