import React from "react";
import { Box, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { DesignerIcon, designerSections } from "./designerSections";
import DesignerNav from "./shared/DesignerNav";

export default function Main() {
  return (
    <Box
      minH="100vh"
      px={{ base: 4, md: 8, xl: 12 }}
      py={{ base: 6, md: 10 }}
      bgGradient="linear(to-b, editor.shellGradientStart, editor.shellGradientEnd)"
    >
      <Box
        maxW="1200px"
        mx="auto"
        p={{ base: 5, md: 8 }}
        borderRadius="32px"
        bg="editor.shellCard"
        border="1px solid" borderColor="editor.borderAccentMuted"
        boxShadow="0 24px 60px rgba(52, 66, 45, 0.12)"
        backdropFilter="blur(12px)"
      >
        <DesignerNav showDesignerHome={false} />
        <Text
          fontSize="sm"
          fontWeight="700"
          textTransform="uppercase"
          letterSpacing="0.18em"
          color="editor.accentMuted"
          mb={3}
        >
          Designer
        </Text>
        <Heading
          as="h1"
          size="xl"
          color="editor.heading"
          maxW="560px"
          lineHeight="1.1"
          mb={3}
        >
          Choose the workspace you want to edit.
        </Heading>
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color="editor.textSubtle"
          maxW="720px"
          mb={{ base: 6, md: 8 }}
        >
          Each workspace opens inside the same SPA flow and starts with demo
          content so the menu actions can be tested immediately.
        </Text>

        <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} spacing={{ base: 4, md: 5 }}>
          {designerSections.map((section) => (
            <Box
              key={section.key}
              as={RouterLink}
              to={section.path}
              minH={{ base: "124px", md: "140px" }}
              px={{ base: 4, md: 6 }}
              py={{ base: 4, md: 5 }}
              borderRadius="24px"
              border="1px solid" borderColor="editor.borderAccent"
              bg="editor.surface"
              color="editor.heading"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={3}
              textAlign="center"
              transition="transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
              boxShadow="0 14px 30px rgba(59, 78, 55, 0.08)"
              _hover={{
                transform: "translateY(-3px)",
                borderColor: "editor.borderAccent",
                boxShadow: "0 18px 34px rgba(59, 78, 55, 0.14)",
                textDecoration: "none",
              }}
            >
              <Box
                w="56px"
                h="56px"
                borderRadius="18px"
                display="grid"
                placeItems="center"
                bg="editor.accentSoft"
                color="editor.accent"
              >
                <DesignerIcon icon={section.icon} boxSize={8} />
              </Box>
              <Text
                fontSize={{ base: "md", md: "lg" }}
                fontWeight="700"
                letterSpacing="-0.01em"
              >
                {section.title}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
