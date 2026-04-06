-- Seed data: common tree species with IPCC Tier 1 CO₂ coefficients
INSERT INTO public.species (name_latin, name_common_en, name_common_ru, co2_kg_per_year_avg, co2_kg_per_year_min, co2_kg_per_year_max, rekognition_label)
VALUES
  ('Quercus robur',      'English Oak',       'Дуб черешчатый',  48.0, 22.0, 80.0, 'oak'),
  ('Betula pendula',     'Silver Birch',      'Берёза повислая', 22.0, 12.0, 35.0, 'birch'),
  ('Pinus sylvestris',   'Scots Pine',        'Сосна обыкновенная', 30.0, 15.0, 50.0, 'pine'),
  ('Tilia cordata',      'Small-leaved Lime', 'Липа сердцелистная', 25.0, 12.0, 40.0, 'linden'),
  ('Acer platanoides',   'Norway Maple',      'Клён остролистный', 18.0, 9.0, 30.0, 'maple'),
  ('Populus tremula',    'Aspen',             'Осина',           35.0, 18.0, 60.0, 'aspen'),
  ('Picea abies',        'Norway Spruce',     'Ель обыкновенная', 28.0, 14.0, 45.0, 'spruce'),
  ('Fraxinus excelsior', 'Common Ash',        'Ясень обыкновенный', 32.0, 16.0, 55.0, 'ash'),
  ('Alnus glutinosa',    'Common Alder',      'Ольха чёрная',   20.0, 10.0, 35.0, 'alder'),
  ('Robinia pseudoacacia','Black Locust',     'Робиния лжеакация', 40.0, 20.0, 65.0, 'locust');
