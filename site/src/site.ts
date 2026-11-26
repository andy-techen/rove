// Where the site points. Change these in one place.
export const REPO = 'andy-techen/rove'
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

// The Buttondown newsletter behind "Get updates". Until it's set, the form is left out
// rather than posting somewhere that doesn't exist.
export const BUTTONDOWN_USER: string = ''

// The sneak peek's recording: three files in site/public (one per track, the same
// length, made to loop). Until it's set, the demo plays a synthesised placeholder.
export const DEMO_AUDIO: { backing: string; lead: string; harmony: string } | null = null

// Where "Join the community" in the footer sends the visitor's email: a form service's
// endpoint (Formspree, https://formspree.io/f/<id>), since GitHub Pages can't receive a
// post. Until it's set, the field shows but can't be sent.
export const JOIN_FORM_URL: string = ''
