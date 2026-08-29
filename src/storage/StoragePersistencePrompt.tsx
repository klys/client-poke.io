import { useEffect, useRef } from "react";
import { Button, HStack, Text, VStack, useToast } from "@chakra-ui/react";
import { useT } from "../i18n";
import {
  formatBytes,
  getStorageStatus,
  refreshStorageStatus,
  retryPersistentStorageRequest,
} from "./clientStorage";

const DISMISSED_KEY = "client-poke.io.storage.persist-prompt-dismissed";

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* best effort */
  }
}

/**
 * Asks once per browser for persistent storage when the automatic request at
 * boot was not granted (Chromium decides silently; Firefox prompts natively).
 * Renders nothing — it only raises a toast with Allow / Not now.
 */
export default function StoragePersistencePrompt() {
  const toast = useToast();
  const t = useT();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current || wasDismissed()) {
      return;
    }

    if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
      return;
    }

    let cancelled = false;

    // Give the boot request a moment to settle, then check the outcome.
    const timer = window.setTimeout(async () => {
      const status = await refreshStorageStatus();

      if (cancelled || shownRef.current || status.persisted !== false) {
        return;
      }

      shownRef.current = true;

      const toastId = toast({
        duration: null,
        isClosable: true,
        position: "top",
        onCloseComplete: markDismissed,
        render: ({ onClose }) => (
          <VStack
            align="stretch"
            spacing={2}
            bg="gray.800"
            color="white"
            p={4}
            borderRadius="md"
            boxShadow="lg"
            maxW="420px"
          >
            <Text fontWeight="700">{t("storage.prompt.title")}</Text>
            <Text fontSize="sm">
              {t("storage.prompt.body", { usage: formatBytes(getStorageStatus().usageBytes) })}
            </Text>
            <HStack justify="flex-end">
              <Button size="sm" variant="ghost" onClick={onClose}>
                {t("storage.prompt.later")}
              </Button>
              <Button
                size="sm"
                colorScheme="teal"
                onClick={async () => {
                  const granted = await retryPersistentStorageRequest();

                  onClose();
                  toast({
                    title: granted ? t("storage.prompt.granted") : t("settings.storage.denied"),
                    status: granted ? "success" : "warning",
                    duration: 6000,
                    isClosable: true,
                    position: "top",
                  });
                }}
              >
                {t("storage.prompt.allow")}
              </Button>
            </HStack>
          </VStack>
        ),
      });

      if (toastId === undefined) {
        shownRef.current = false;
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [t, toast]);

  return null;
}
