import React from "react";
import { Button, HStack, Spacer, Text, useColorMode } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../../context/authContext";

// Shared top navigation for every designer page: gets the user back to the
// game and to the other tools they are allowed to see. Permission-gated so a
// pure designer never sees admin/moderator entries. Colors come from the
// editor.* semantic tokens so the bar works in light and dark mode alike.
export default function DesignerNav({
  title,
  showDesignerHome = true,
}: {
  title?: string;
  showDesignerHome?: boolean;
}) {
  const { hasPermission } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const navButtonProps = {
    size: "sm" as const,
    variant: "outline" as const,
    borderColor: "editor.borderAccent",
    color: "editor.accent",
    _hover: { bg: "editor.accentSoft" },
  };

  return (
    <HStack spacing={2} mb={4} flexWrap="wrap">
      <Button as={RouterLink} to="/" {...navButtonProps}>
        ← Back to Game
      </Button>
      {showDesignerHome ? (
        <Button as={RouterLink} to="/designer" {...navButtonProps}>
          Designer Home
        </Button>
      ) : null}
      {hasPermission("admin.access") ? (
        <Button as={RouterLink} to="/admin" {...navButtonProps}>
          Admin Panel
        </Button>
      ) : null}
      {hasPermission("moderator.access") ? (
        <Button as={RouterLink} to="/moderator" {...navButtonProps}>
          Moderation
        </Button>
      ) : null}
      <Button onClick={toggleColorMode} {...navButtonProps}>
        {colorMode === "dark" ? "Light mode" : "Dark mode"}
      </Button>
      <Spacer />
      {title ? (
        <Text fontSize="sm" fontWeight="700" color="editor.accentMuted">
          {title}
        </Text>
      ) : null}
    </HStack>
  );
}
