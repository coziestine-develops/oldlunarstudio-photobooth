/** Default photo-editor state (shared by OldLunar and PairSnap). */
export const DEFAULT_EDITOR = {
  adjustments: { brightness:100, contrast:100, saturation:100, grain:0 },
  stylePreset: 'classic',
  frameStyle:  'classic',
  bgColor:     'cream',
  bgStyle:     'solid',
  layout:      'strip',
  // text
  caption:     'OLDLUNAR STUDIO',
  showCaption: true,
  text:        '',
  showText:    false,
  textPos:     'bottom',
  fontSize:    'md',
  // date
  showDate:    true,
  dateFormat:  'dmy',
  datePos:     'bottom',
  // layout
  spacing:     0,
  padding:     24,
  border:      0,
  radius:      0,
  // decorations
  stickers:    [],
  stickerSize: 1,
  stickerColor:'pink',
  showNumbers: false,
};