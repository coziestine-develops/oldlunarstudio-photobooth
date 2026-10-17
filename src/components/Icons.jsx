/**
 * Font Awesome icon set for the whole app.
 * Every icon renders through one wrapper so size, alignment and spacing stay consistent:
 * a fixed square box (`size` px) with the glyph centred inside it.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faArrowRight, faCalendarDays, faCamera, faCheck, faChevronDown, faChevronLeft, faChevronRight,
  faClock, faCrown, faDownload, faExpand, faCompress, faFilm, faHeart, faImage, faLock, faMoon, faPalette,
  faPlus, faPrint, faQrcode, faRotateLeft, faShareNodes, faShieldHalved, faSliders, faStar, faTableCellsLarge,
  faTrashCan, faUser, faUserGroup, faUsers, faVolumeHigh, faVolumeXmark, faWandMagicSparkles, faXmark,
  faFont, faBorderAll, faCameraRotate, faCircleHalfStroke, faImages, faMobileScreen, faKeyboard, faStopwatch,
} from '@fortawesome/free-solid-svg-icons';

/* Glyphs sit tighter in their box than the old outline icons did, so they are scaled to 0.85 of the box. */
const GLYPH_SCALE = 0.85;

/** Build a size-aware icon component from a Font Awesome definition. `strokeWidth` is accepted and ignored. */
const make = (def) => function FaIcon({ size = 20, className = '', style, strokeWidth, ...rest }) {  // eslint-disable-line no-unused-vars
  return (
    <FontAwesomeIcon
      icon={def}
      className={className}
      style={{ width: size, height: size, fontSize: Math.round(size * GLYPH_SCALE * 10) / 10, flex: 'none', ...style }}
      {...rest}
    />
  );
};

export const ArrowLeft    = make(faArrowLeft);
export const ArrowRight   = make(faArrowRight);
export const Calendar     = make(faCalendarDays);
export const Camera       = make(faCamera);
export const Check        = make(faCheck);
export const CameraRotate = make(faCameraRotate);
export const ChevronDown  = make(faChevronDown);
export const Crown        = make(faCrown);
export const Download     = make(faDownload);
export const Film         = make(faFilm);
export const Frame        = make(faBorderAll);
export const Heart        = make(faHeart);
export const LayoutGrid   = make(faTableCellsLarge);
export const Lock         = make(faLock);
export const Maximize2    = make(faExpand);
export const Minimize2    = make(faCompress);
export const Moon         = make(faMoon);
export const Palette      = make(faPalette);
export const Printer      = make(faPrint);
export const QrCode       = make(faQrcode);
export const RotateCcw    = make(faRotateLeft);
export const Share2       = make(faShareNodes);
export const Sparkles     = make(faWandMagicSparkles);
export const Star         = make(faStar);
export const Trash2       = make(faTrashCan);
export const Type         = make(faFont);
export const User         = make(faUser);
export const Users        = make(faUserGroup);
export const UsersRound   = make(faUsers);
export const Volume2      = make(faVolumeHigh);
export const VolumeX      = make(faVolumeXmark);
export const WandSparkles = make(faWandMagicSparkles);
export const X            = make(faXmark);

/* Extra glyphs used by the landing-page `Icon` (string-name lookup) and the gallery/countdown arrows */
export const ChevronLeft  = make(faChevronLeft);
export const ChevronRight = make(faChevronRight);
export const Clock        = make(faClock);
export const Plus         = make(faPlus);
export const Sliders      = make(faSliders);
export const Image        = make(faImage);
export const Shield       = make(faShieldHalved);
export const Images       = make(faImages);
export const Stopwatch    = make(faStopwatch);
export const Contrast     = make(faCircleHalfStroke);
export const Keyboard     = make(faKeyboard);
export const Mobile       = make(faMobileScreen);