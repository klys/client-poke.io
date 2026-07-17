import { extendTheme, ThemeConfig } from "@chakra-ui/react";

// Light stays the default so existing screens keep their exact appearance;
// the designer header exposes a toggle. index.html also carries
// <meta name="darkreader-lock"> so dark-mode extensions defer to this
// native theme instead of filter-inverting the canvases.
const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  semanticTokens: {
    colors: {
      // Designer/editor chrome. Light values are the palette the editor
      // always used; dark values are green-tinted counterparts.
      "editor.page": { default: "#ffffff", _dark: "#141a16" },
      "editor.pageMuted": { default: "#f7f7f7", _dark: "#171d18" },
      "editor.surface": { default: "#f8faf7", _dark: "#1a211b" },
      "editor.raised": { default: "#fffdf8", _dark: "#202822" },
      "editor.well": { default: "#e8ede5", _dark: "#0f130f" },
      "editor.overlay": {
        default: "rgba(255, 255, 255, 0.96)",
        _dark: "rgba(20, 26, 22, 0.94)",
      },
      "editor.heading": { default: "#233127", _dark: "#e5ede5" },
      "editor.text": { default: "#314636", _dark: "#cfdcd1" },
      "editor.textMuted": { default: "#5f6d61", _dark: "#a0b0a2" },
      "editor.textSubtle": { default: "#55645a", _dark: "#93a495" },
      "editor.textFaint": { default: "#4d6652", _dark: "#8aa08e" },
      "editor.accent": { default: "#2e5b37", _dark: "#86c290" },
      "editor.accentMuted": { default: "#5e7a61", _dark: "#9cb8a0" },
      "editor.border": {
        default: "rgba(35, 49, 39, 0.16)",
        _dark: "rgba(226, 235, 227, 0.18)",
      },
      "editor.borderMuted": {
        default: "rgba(35, 49, 39, 0.12)",
        _dark: "rgba(226, 235, 227, 0.14)",
      },
      "editor.borderFaint": {
        default: "rgba(35, 49, 39, 0.08)",
        _dark: "rgba(226, 235, 227, 0.10)",
      },
      "editor.borderAccent": {
        default: "rgba(43, 66, 47, 0.24)",
        _dark: "rgba(226, 235, 227, 0.30)",
      },
      "editor.borderAccentMuted": {
        default: "rgba(43, 66, 47, 0.12)",
        _dark: "rgba(226, 235, 227, 0.14)",
      },
      "editor.borderAccentFaint": {
        default: "rgba(43, 66, 47, 0.08)",
        _dark: "rgba(226, 235, 227, 0.10)",
      },
      "editor.warning": { default: "#8b5a20", _dark: "#d9a558" },
      "editor.danger": { default: "#914335", _dark: "#e2907f" },
      "editor.card": {
        default: "rgba(255, 255, 255, 0.78)",
        _dark: "rgba(255, 255, 255, 0.05)",
      },
      "editor.cardSelected": {
        default: "rgba(232, 244, 228, 0.96)",
        _dark: "rgba(86, 128, 94, 0.32)",
      },
      "editor.cardSelectedBorder": {
        default: "rgba(46, 91, 55, 0.44)",
        _dark: "rgba(134, 194, 144, 0.55)",
      },
      "editor.wellSoft": {
        default: "rgba(35, 49, 39, 0.06)",
        _dark: "rgba(226, 235, 227, 0.08)",
      },
    },
  },
  components: {
    Modal: {
      defaultProps: {
        scrollBehavior: "inside",
      },
      baseStyle: {
        dialogContainer: {
          alignItems: "flex-start",
          px: { base: 4, md: 6 },
          py: { base: 4, md: 10 },
        },
        dialog: {
          my: 0,
          maxH: "calc(100vh - 2rem)",
        },
      },
    },
  },
});

export default theme;
