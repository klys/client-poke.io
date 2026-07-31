import React from "react";
import { Button, HStack, Spacer, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../../context/authContext";

// Shared top navigation for every designer page: gets the user back to the
// game and to the other tools they are allowed to see. Permission-gated so a
// pure designer never sees admin/moderator entries.
export default function DesignerNav({
  title,
  showDesignerHome = true,
}: {
  title?: string;
  showDesignerHome?: boolean;
}) {
  const { hasPermission } = useAuth();

  return (
    <HStack spacing={2} mb={4} flexWrap="wrap">
      <Button as={RouterLink} to="/" size="sm" variant="outline">
        ← Back to Game
      </Button>
      {showDesignerHome ? (
        <Button as={RouterLink} to="/designer" size="sm" variant="outline">
          Designer Home
        </Button>
      ) : null}
      {hasPermission("admin.access") ? (
        <Button as={RouterLink} to="/admin" size="sm" variant="outline">
          Admin Panel
        </Button>
      ) : null}
      {hasPermission("moderator.access") ? (
        <Button as={RouterLink} to="/moderator" size="sm" variant="outline">
          Moderation
        </Button>
      ) : null}
      <Spacer />
      {title ? (
        <Text fontSize="sm" fontWeight="700" color="gray.500">
          {title}
        </Text>
      ) : null}
    </HStack>
  );
}
