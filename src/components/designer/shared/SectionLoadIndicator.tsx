import React, { useEffect, useState } from "react";
import { Box, Button, HStack, Progress, Text } from "@chakra-ui/react";
import type { DesignerSectionKey } from "../designerSections";
import {
  fetchDesignerSectionOverHttp,
  getDesignerSectionLoadProgress,
  subscribeDesignerSectionLoad,
  type DesignerSectionLoadProgress,
} from "../designerSectionHttp";

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Renders the download state of a designer section fetched over HTTP:
// determinate progress with MB counters while downloading, an error banner
// with a Retry button on failure, and nothing once the payload is cached.
export default function SectionLoadIndicator({
  sectionKey,
  label,
}: {
  sectionKey: DesignerSectionKey;
  label?: string;
}) {
  const [progress, setProgress] = useState<DesignerSectionLoadProgress | null>(() =>
    getDesignerSectionLoadProgress(sectionKey)
  );

  useEffect(() => {
    setProgress(getDesignerSectionLoadProgress(sectionKey));

    return subscribeDesignerSectionLoad((update) => {
      if (update.sectionKey === sectionKey) {
        setProgress(update);
      }
    });
  }, [sectionKey]);

  if (!progress || progress.phase === "done") {
    return null;
  }

  const sectionLabel = label ?? sectionKey;

  if (progress.phase === "error") {
    return (
      <Box borderWidth="1px" borderRadius="8px" borderColor="red.300" bg="red.50" p={3} mb={4}>
        <HStack justify="space-between">
          <Text fontSize="sm" color="red.700" fontWeight="600">
            Failed to download {sectionLabel} data. Check your connection and retry.
          </Text>
          <Button
            size="xs"
            colorScheme="red"
            variant="outline"
            onClick={() => void fetchDesignerSectionOverHttp(sectionKey)}
          >
            Retry
          </Button>
        </HStack>
      </Box>
    );
  }

  const hasTotal = progress.totalBytes !== null && progress.totalBytes > 0;
  const percent = hasTotal
    ? Math.min(100, (progress.loadedBytes / (progress.totalBytes as number)) * 100)
    : undefined;

  return (
    <Box borderWidth="1px" borderRadius="8px" p={3} mb={4}>
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" fontWeight="600">
          {progress.phase === "parsing"
            ? `Preparing ${sectionLabel} data…`
            : `Downloading ${sectionLabel} data…`}
        </Text>
        <Text fontSize="xs" color="editor.textMuted">
          {hasTotal
            ? `${formatMegabytes(progress.loadedBytes)} / ${formatMegabytes(
                progress.totalBytes as number
              )} MB`
            : `${formatMegabytes(progress.loadedBytes)} MB`}
        </Text>
      </HStack>
      <Progress
        size="sm"
        borderRadius="4px"
        value={percent}
        isIndeterminate={percent === undefined || progress.phase === "parsing"}
      />
    </Box>
  );
}
