# 🌈 Nyan-Cat Petition Race

A humorous real-time visualization of UK Parliament petition signature counts, featuring racing Nyan Cats!

## Live Demo

[https://denis.github.io/nyan-migrants/](https://denis.github.io/nyan-migrants/)

## Overview

This project tracks two UK Parliament petitions in real-time:
- **Anti-immigration petition**: "Close the borders! Suspend ALL immigration for 5 years!"
- **Pro-immigration petition**: "Keep the 5-Year ILR pathway for existing Skilled Worker visa holders"

Watch as Nyan Cats race across the screen based on live signature counts!

## Features

- 🏁 Real-time petition signature tracking (updates every 15 seconds)
- 🐱 Animated Nyan Cats with rainbow trails
- 👑 Dynamic leader crown
- 🎵 8-bit background music with volume ducking
- 📱 Fully responsive design
- ♿ Accessibility-first approach
- 🌙 Dark/light mode support

## Tech Stack

- Pure HTML/CSS/JavaScript (no framework dependencies)
- CSS Grid & Flexbox for responsive layout
- Web Audio API for sound effects
- Fetch API for petition data
- No build process required

## Installation

1. Clone the repository:
```bash
git clone https://github.com/denis/nyan-migrants.git
cd nyan-migrants
```

2. Open `index.html` in a web browser or serve with any static file server:
```bash
python -m http.server 8000
# or
npx serve
```

## Development

### Project Structure
```
nyan-migrants/
├── index.html          # Main HTML file
├── style.css           # Styles and animations
├── main.js             # Core JavaScript logic
├── assets/
│   ├── nyan-cat.svg    # Nyan Cat graphic
│   ├── nyan-bgm.mp3    # Background music
│   └── favicon.png     # Site favicon
├── tests/
│   └── petition.test.js # Test stubs
└── README.md
```

### Testing

Run tests with:
```bash
npm test
```

### Performance Audit

Run Lighthouse audit:
```bash
npm run audit
```

Target scores:
- Performance: ≥ 90
- Accessibility: ≥ 90
- Best Practices: ≥ 90

## API Usage

The app polls the UK Parliament Petitions API:
```
https://petition.parliament.uk/petitions/{id}/count.json
```

Rate limiting is handled gracefully with error toasts.

## Accessibility

- Keyboard navigation support
- Screen reader announcements
- Respects `prefers-reduced-motion`
- High contrast color scheme
- ARIA labels and live regions

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- UK Parliament Petitions API
- Nyan Cat by Christopher Torres
- 8-bit music community