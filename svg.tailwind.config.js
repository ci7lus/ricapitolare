module.exports = {
  purge: {
    enabled: true,
    mode: "all",
    content: ["./src/image/ogpSvg.ts"],
    whitelist: ["svg"],
    whitelistPatterns: [],
  },
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true,
  },
  darkMode: "media",
}
