import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
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
