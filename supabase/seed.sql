insert into prompts (text, type, goal_tags, genre_tags, duration_min) values
('Sing any comfortable note and hold it for as long as you can.',
 'warmup', array['expand_range','consistency'], array['all'], 2),

('Sing the first line of any song you know, twice.',
 'warmup', array['confidence','consistency'], array['all'], 2),

('Start on your lowest comfortable note and slowly slide up as high as you can go.',
 'focus', array['expand_range'], array['all'], 5),

('Sing a phrase like you are completely exhausted.',
 'expressive', array['confidence'], array['pop','rnb','musical_theatre'], 5),

('Sing this phrase in your brightest tone, then your darkest: any line you know well.',
 'expressive', array['confidence'], array['pop','musical_theatre','folk'], 5),

('Pick a chorus you know and sing it at half your normal volume.',
 'focus', array['confidence','expand_range'], array['pop','rnb'], 5),

('Hum any melody for 60 seconds without stopping.',
 'warmup', array['consistency'], array['all'], 2),

('Sing a scale starting from wherever feels easy today.',
 'warmup', array['expand_range','consistency'], array['all'], 2),

('Sing one line of a song three times. Each time, try to make it feel more intentional.',
 'expressive', array['confidence','specific_song'], array['all'], 5),

('Find the highest note you can hit comfortably today. Hold it for 3 seconds.',
 'focus', array['expand_range'], array['all'], 5),

('Sing a phrase softly, then repeat it as loud as feels comfortable.',
 'focus', array['expand_range','confidence'], array['all'], 5),

('Choose a song you know and sing just the first verse, no stopping.',
 'focus', array['specific_song','consistency'], array['all'], 5),

('Sing a slow melody and try to make every note connect smoothly to the next.',
 'expressive', array['confidence'], array['pop','folk','musical_theatre'], 5),

('Sing any line and hold the last note for as long as you can.',
 'focus', array['expand_range','consistency'], array['all'], 2),

('Hum a tune you make up on the spot for 30 seconds.',
 'expressive', array['confidence'], array['all'], 2);
