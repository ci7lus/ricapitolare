mkdir -p dist
NODE_ENV=production yarn tailwindcss build -i ./svg.css -c ./svg.tailwind.config.js -o ./dist/svg.tailwind.css
