# 🐱 UK Immigration Petition Race

Real-time visualization of UK Parliament immigration petitions with racing Nyan Cats.

**[Live Demo →](https://borovikovd.github.io/visacats/)**

## What It Does

Tracks two competing UK immigration petitions:
- 🚫 **Anti-immigration**: "Close the borders! Suspend ALL immigration for 5 years!"
- ✅ **Pro-immigration**: "Keep the 5-Year ILR pathway for existing Skilled Worker visa holders"

Nyan Cats race based on live signature counts, updated every 15 seconds.

## Features

- 🏁 Real-time petition tracking
- 🌈 Animated Nyan Cats with rainbow trails
- 👑 Leader crown for top petition
- 🎵 8-bit synthesized music
- 📱 Responsive design
- ♿ Screen reader support

## Quick Start

```bash
git clone https://github.com/borovikovd/visacats.git
cd visacats
python -m http.server 8000
# Open http://localhost:8000
```

## Deploy to GitHub Pages

1. Fork this repo
2. Go to **Settings** → **Pages**
3. Set source to `main` branch
4. Visit `https://yourusername.github.io/visacats`

## Development

```bash
npm test                # Run tests
npm run test:coverage   # Coverage report
npm run audit          # Lighthouse audit
```

**Tech Stack**: Pure HTML/CSS/JS • Web Audio API • No build required

**Browser Support**: Chrome, Firefox, Safari (latest)

## License

MIT