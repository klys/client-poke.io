import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  DesignerIcon,
  type DesignerMapObjectAsset,
  type DesignerMapObjectType,
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerSectionKey,
} from "./designerSections";

interface DesignerSectionState {
  categories: string[];
  items: DesignerItemSeed[];
}

interface DesignerSectionProps {
  sectionKey: DesignerSectionKey;
}

const UNCATEGORIZED = "Uncategorized";
const ALL_CATEGORIES = "__all__";
const MAP_OBJECT_TYPES: DesignerMapObjectType[] = [
  "obstacle",
  "mob area",
  "floor",
  "water",
];
const DEFAULT_MAP_OBJECT_TYPE: DesignerMapObjectType = "obstacle";
const DEFAULT_MAP_OBJECT_SIZE = 64;

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function findCategoryName(categories: string[], target: string) {
  const normalizedTarget = normalizeCategoryName(target).toLowerCase();

  return categories.find(
    (category) => normalizeCategoryName(category).toLowerCase() === normalizedTarget
  );
}

function getStorageKey(sectionKey: DesignerSectionKey) {
  return `designer-demo:${sectionKey}`;
}

function isValidMapObjectType(value: unknown): value is DesignerMapObjectType {
  return (
    typeof value === "string" &&
    MAP_OBJECT_TYPES.includes(value as DesignerMapObjectType)
  );
}

function sanitizeMapObjectAsset(value: unknown): DesignerMapObjectAsset | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<DesignerMapObjectAsset>;
  const width =
    typeof candidate.width === "number" && Number.isFinite(candidate.width)
      ? Math.max(1, Math.round(candidate.width))
      : null;
  const height =
    typeof candidate.height === "number" && Number.isFinite(candidate.height)
      ? Math.max(1, Math.round(candidate.height))
      : null;

  if (
    typeof candidate.imageSrc !== "string" ||
    !candidate.imageSrc ||
    width === null ||
    height === null ||
    !isValidMapObjectType(candidate.objectType)
  ) {
    return undefined;
  }

  return {
    imageSrc: candidate.imageSrc,
    width,
    height,
    objectType: candidate.objectType,
  };
}

function buildInitialState(sectionKey: DesignerSectionKey): DesignerSectionState {
  const section = designerSectionsByKey[sectionKey];
  const categorySet = new Set([UNCATEGORIZED, ...section.defaultCategories]);

  section.demoItems.forEach((item) => {
    categorySet.add(item.category || UNCATEGORIZED);
  });

  return {
    categories: Array.from(categorySet),
    items: section.demoItems,
  };
}

function loadStoredState(sectionKey: DesignerSectionKey): DesignerSectionState {
  const fallback = buildInitialState(sectionKey);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(sectionKey));
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
      return fallback;
    }

    const categories = Array.from(
      new Set(
        [UNCATEGORIZED, ...parsed.categories]
          .map((category) => normalizeCategoryName(category))
          .filter(Boolean)
      )
    );

    const items = parsed.items
      .filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      )
      .map((item) => ({
        ...item,
        category: normalizeCategoryName(item.category) || UNCATEGORIZED,
        mapObjectAsset: sanitizeMapObjectAsset(item.mapObjectAsset),
      }));

    items.forEach((item) => categories.push(item.category));

    return {
      categories: Array.from(new Set(categories)),
      items,
    };
  } catch {
    return fallback;
  }
}

export default function Section({ sectionKey }: DesignerSectionProps) {
  const section = designerSectionsByKey[sectionKey];
  const isObjectsSection = sectionKey === "objects";
  const [sectionState, setSectionState] = useState<DesignerSectionState>(() =>
    loadStoredState(sectionKey)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemCategory, setEditItemCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [moveCategory, setMoveCategory] = useState(
    sectionState.categories[0] || UNCATEGORIZED
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(UNCATEGORIZED);
  const [newMapObjectImage, setNewMapObjectImage] = useState("");
  const [newMapObjectWidth, setNewMapObjectWidth] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [newMapObjectHeight, setNewMapObjectHeight] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [newMapObjectType, setNewMapObjectType] =
    useState<DesignerMapObjectType>(DEFAULT_MAP_OBJECT_TYPE);
  const [editMapObjectImage, setEditMapObjectImage] = useState("");
  const [editMapObjectWidth, setEditMapObjectWidth] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [editMapObjectHeight, setEditMapObjectHeight] = useState(
    String(DEFAULT_MAP_OBJECT_SIZE)
  );
  const [editMapObjectType, setEditMapObjectType] =
    useState<DesignerMapObjectType>(DEFAULT_MAP_OBJECT_TYPE);

  useEffect(() => {
    setSectionState(loadStoredState(sectionKey));
    setSelectedIds([]);
    setIsAddOpen(false);
    setIsEditOpen(false);
    setEditingItemId(null);
    setSearchTerm("");
    setCategoryFilter(ALL_CATEGORIES);
    setEditingCategory(null);
    setDeletingCategory(null);
  }, [sectionKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getStorageKey(sectionKey),
      JSON.stringify(sectionState)
    );
  }, [sectionKey, sectionState]);

  useEffect(() => {
    if (!sectionState.categories.includes(newItemCategory)) {
      setNewItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (!sectionState.categories.includes(editItemCategory)) {
      setEditItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (!sectionState.categories.includes(moveCategory)) {
      setMoveCategory(sectionState.categories[0] || UNCATEGORIZED);
    }

    if (
      categoryFilter !== ALL_CATEGORIES &&
      !sectionState.categories.includes(categoryFilter)
    ) {
      setCategoryFilter(ALL_CATEGORIES);
    }

    if (
      deleteCategoryTarget !== UNCATEGORIZED &&
      !sectionState.categories.includes(deleteCategoryTarget)
    ) {
      setDeleteCategoryTarget(UNCATEGORIZED);
    }
  }, [
    categoryFilter,
    deleteCategoryTarget,
    editItemCategory,
    moveCategory,
    newItemCategory,
    sectionState.categories,
  ]);

  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const parsedMapObjectWidth = Number.parseInt(newMapObjectWidth, 10);
  const parsedMapObjectHeight = Number.parseInt(newMapObjectHeight, 10);
  const parsedEditMapObjectWidth = Number.parseInt(editMapObjectWidth, 10);
  const parsedEditMapObjectHeight = Number.parseInt(editMapObjectHeight, 10);
  const hasValidMapObjectWidth =
    Number.isFinite(parsedMapObjectWidth) && parsedMapObjectWidth > 0;
  const hasValidMapObjectHeight =
    Number.isFinite(parsedMapObjectHeight) && parsedMapObjectHeight > 0;
  const hasValidEditMapObjectWidth =
    Number.isFinite(parsedEditMapObjectWidth) && parsedEditMapObjectWidth > 0;
  const hasValidEditMapObjectHeight =
    Number.isFinite(parsedEditMapObjectHeight) && parsedEditMapObjectHeight > 0;
  const isMapObjectFormValid =
    !isObjectsSection ||
    (!!newMapObjectImage && hasValidMapObjectWidth && hasValidMapObjectHeight);
  const isEditMapObjectFormValid =
    !isObjectsSection ||
    (!!editMapObjectImage &&
      hasValidEditMapObjectWidth &&
      hasValidEditMapObjectHeight);

  const categorySummary = useMemo(
    () =>
      sectionState.categories.map((category) => ({
        name: category,
        count: sectionState.items.filter((item) => item.category === category).length,
      })),
    [sectionState.categories, sectionState.items]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sectionState.items.filter((item) => {
      const matchesName =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === ALL_CATEGORIES || item.category === categoryFilter;

      return matchesName && matchesCategory;
    });
  }, [categoryFilter, searchTerm, sectionState.items]);

  const deleteCategoryOptions = useMemo(() => {
    return [UNCATEGORIZED, ...sectionState.categories.filter((category) => category !== deletingCategory && category !== UNCATEGORIZED)];
  }, [deletingCategory, sectionState.categories]);

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  const openAddModal = () => {
    setNewItemName("");
    setNewItemCategory(sectionState.categories[0] || UNCATEGORIZED);
    setNewMapObjectImage("");
    setNewMapObjectWidth(String(DEFAULT_MAP_OBJECT_SIZE));
    setNewMapObjectHeight(String(DEFAULT_MAP_OBJECT_SIZE));
    setNewMapObjectType(DEFAULT_MAP_OBJECT_TYPE);
    setIsAddOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingItemId(null);
  };

  const openEditModal = (item: DesignerItemSeed) => {
    const mapObjectAsset = sanitizeMapObjectAsset(item.mapObjectAsset);

    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemCategory(item.category || sectionState.categories[0] || UNCATEGORIZED);
    setEditMapObjectImage(mapObjectAsset?.imageSrc || "");
    setEditMapObjectWidth(String(mapObjectAsset?.width || DEFAULT_MAP_OBJECT_SIZE));
    setEditMapObjectHeight(String(mapObjectAsset?.height || DEFAULT_MAP_OBJECT_SIZE));
    setEditMapObjectType(mapObjectAsset?.objectType || DEFAULT_MAP_OBJECT_TYPE);
    setIsEditOpen(true);
  };

  const openCategoriesModal = () => {
    setNewCategoryName("");
    setEditingCategory(null);
    setEditingCategoryName("");
    setDeletingCategory(null);
    setDeleteCategoryTarget(UNCATEGORIZED);
    setIsCategoriesOpen(true);
  };

  const openMoveModal = () => {
    setMoveCategory(sectionState.categories[0] || UNCATEGORIZED);
    setIsMoveOpen(true);
  };

  const handleAddCategory = () => {
    const normalizedCategory = normalizeCategoryName(newCategoryName);

    if (!normalizedCategory) {
      return;
    }

    setSectionState((current) => {
      const existingCategory = findCategoryName(current.categories, normalizedCategory);
      if (existingCategory) {
        return current;
      }

      return {
        ...current,
        categories: [...current.categories, normalizedCategory],
      };
    });

    setNewCategoryName("");
  };

  const startEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
    setDeletingCategory(null);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const handleSaveCategory = () => {
    if (!editingCategory) {
      return;
    }

    const normalizedCategory = normalizeCategoryName(editingCategoryName);
    if (!normalizedCategory) {
      return;
    }

    if (editingCategory === UNCATEGORIZED) {
      return;
    }

    setSectionState((current) => {
      const existingCategory = findCategoryName(current.categories, normalizedCategory);
      const renamedTo = existingCategory && existingCategory !== editingCategory
        ? existingCategory
        : normalizedCategory;

      return {
        categories: current.categories
          .map((category) => (category === editingCategory ? renamedTo : category))
          .filter(
            (category, index, list) =>
              list.findIndex((value) => value.toLowerCase() === category.toLowerCase()) === index
          ),
        items: current.items.map((item) =>
          item.category === editingCategory
            ? { ...item, category: renamedTo }
            : item
        ),
      };
    });

    if (categoryFilter === editingCategory) {
      const existingCategory = findCategoryName(sectionState.categories, normalizedCategory);
      setCategoryFilter(existingCategory && existingCategory !== editingCategory ? existingCategory : normalizedCategory);
    }

    if (newItemCategory === editingCategory) {
      setNewItemCategory(normalizedCategory);
    }

    if (moveCategory === editingCategory) {
      setMoveCategory(normalizedCategory);
    }

    cancelEditCategory();
  };

  const startDeleteCategory = (category: string) => {
    setDeletingCategory(category);
    setDeleteCategoryTarget(UNCATEGORIZED);
    setEditingCategory(null);
  };

  const cancelDeleteCategory = () => {
    setDeletingCategory(null);
    setDeleteCategoryTarget(UNCATEGORIZED);
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory || deletingCategory === UNCATEGORIZED) {
      return;
    }

    const targetCategory = deleteCategoryTarget || UNCATEGORIZED;

    setSectionState((current) => ({
      categories: current.categories.filter((category) => category !== deletingCategory),
      items: current.items.map((item) =>
        item.category === deletingCategory
          ? { ...item, category: targetCategory }
          : item
      ),
    }));

    if (categoryFilter === deletingCategory) {
      setCategoryFilter(targetCategory === UNCATEGORIZED ? ALL_CATEGORIES : targetCategory);
    }

    if (newItemCategory === deletingCategory) {
      setNewItemCategory(targetCategory);
    }

    if (moveCategory === deletingCategory) {
      setMoveCategory(targetCategory);
    }

    cancelDeleteCategory();
  };

  const handleMapObjectImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onImageChange: (value: string) => void
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      onImageChange("");
      return;
    }

    const isAllowedType =
      file.type === "image/png" ||
      file.type === "image/gif" ||
      /\.(png|gif)$/i.test(file.name);

    if (!isAllowedType) {
      window.alert("Please upload a PNG or GIF image for the map object.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageChange(reader.result);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleAddItem = () => {
    const name = newItemName.trim();
    const category = normalizeCategoryName(newItemCategory) || UNCATEGORIZED;

    if (!name || (isObjectsSection && !isMapObjectFormValid)) {
      return;
    }

    setSectionState((current) => {
      const nextIndex = current.items.length + 1;
      const mapObjectAsset =
        isObjectsSection && newMapObjectImage
          ? {
              imageSrc: newMapObjectImage,
              width: parsedMapObjectWidth,
              height: parsedMapObjectHeight,
              objectType: newMapObjectType,
            }
          : undefined;
      const item: DesignerItemSeed = {
        id: `${section.key}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
        name,
        category,
        details: section.createDetails(name, category, nextIndex, {
          mapObjectAsset,
        }),
        mapObjectAsset,
      };

      return {
        categories: current.categories.includes(category)
          ? current.categories
          : [...current.categories, category],
        items: [item, ...current.items],
      };
    });

    setIsAddOpen(false);
  };

  const handleEditItem = () => {
    const name = editItemName.trim();
    const category = normalizeCategoryName(editItemCategory) || UNCATEGORIZED;

    if (!editingItemId || !name || (isObjectsSection && !isEditMapObjectFormValid)) {
      return;
    }

    setSectionState((current) => {
      const mapObjectAsset =
        isObjectsSection && editMapObjectImage
          ? {
              imageSrc: editMapObjectImage,
              width: parsedEditMapObjectWidth,
              height: parsedEditMapObjectHeight,
              objectType: editMapObjectType,
            }
          : undefined;

      return {
        categories: current.categories.includes(category)
          ? current.categories
          : [...current.categories, category],
        items: current.items.map((item, index) =>
          item.id === editingItemId
            ? {
                ...item,
                name,
                category,
                details: section.createDetails(name, category, index + 1, {
                  mapObjectAsset,
                }),
                mapObjectAsset,
              }
            : item
        ),
      };
    });

    closeEditModal();
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) {
      return;
    }

    setSectionState((current) => ({
      ...current,
      items: current.items.filter((item) => !selectedSet.has(item.id)),
    }));
    setSelectedIds([]);
  };

  const handleMoveSelected = () => {
    const category = normalizeCategoryName(moveCategory) || UNCATEGORIZED;

    if (selectedCount === 0) {
      return;
    }

    setSectionState((current) => ({
      categories: current.categories.includes(category)
        ? current.categories
        : [...current.categories, category],
      items: current.items.map((item) =>
        selectedSet.has(item.id) ? { ...item, category } : item
      ),
    }));
    setSelectedIds([]);
    setIsMoveOpen(false);
  };

  return (
    <Box
      minH="100vh"
      px={{ base: 4, md: 8, xl: 12 }}
      py={{ base: 6, md: 10 }}
      bg="linear-gradient(180deg, #f7f4ea 0%, #e8efe5 100%)"
    >
      <Box
        maxW="1280px"
        mx="auto"
        p={{ base: 5, md: 8 }}
        borderRadius="32px"
        bg="rgba(255, 252, 245, 0.92)"
        border="1px solid rgba(58, 76, 52, 0.14)"
        boxShadow="0 24px 60px rgba(52, 66, 45, 0.12)"
        backdropFilter="blur(12px)"
      >
        <Flex
          direction={{ base: "column", lg: "row" }}
          justify="space-between"
          align={{ base: "flex-start", lg: "center" }}
          gap={4}
          mb={8}
        >
          <Box>
            <Text
              fontSize="sm"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.18em"
              color="#5e7a61"
              mb={3}
            >
              Designer / {section.title}
            </Text>
            <Heading as="h1" size="xl" color="#233127" mb={3}>
              {section.title}
            </Heading>
            <Text color="#55645a" maxW="760px">
              {section.description}
            </Text>
          </Box>

          <Button
            as={RouterLink}
            to="/designer"
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.2)"
            color="#2e5b37"
            _hover={{ bg: "rgba(126, 166, 120, 0.08)" }}
          >
            Back to Designer
          </Button>
        </Flex>

        <Box
          mb={8}
          p={{ base: 4, md: 5 }}
          borderRadius="24px"
          bg="linear-gradient(135deg, rgba(255,253,246,0.95) 0%, rgba(237,244,234,0.95) 100%)"
          border="1px solid rgba(43, 66, 47, 0.12)"
        >
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Menu
          </Text>
          <Flex wrap="wrap" gap={3}>
            <Button colorScheme="green" onClick={openAddModal}>
              Add New {section.itemLabel}
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={handleDeleteSelected}
              isDisabled={selectedCount === 0}
            >
              Delete Multiple Elements
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={openCategoriesModal}
            >
              Categories
            </Button>
            <Button
              variant="outline"
              borderColor="rgba(43, 66, 47, 0.24)"
              onClick={openMoveModal}
              isDisabled={selectedCount === 0}
            >
              Move Multiple Elements
            </Button>
          </Flex>
          <Text mt={4} color="#55645a" fontSize="sm">
            Demo mode is active with seeded {section.itemLabelPlural}. {selectedCount} selected.
          </Text>
        </Box>

        <Box mb={8}>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Categories
          </Text>
          <Flex wrap="wrap" gap={3}>
            {categorySummary.map((category) => (
              <Box
                key={category.name}
                px={4}
                py={3}
                borderRadius="18px"
                bg="rgba(126, 166, 120, 0.1)"
                border="1px solid rgba(43, 66, 47, 0.12)"
              >
                <Text fontWeight="700" color="#233127">
                  {category.name}
                </Text>
                <Text fontSize="sm" color="#55645a">
                  {category.count}{" "}
                  {category.count === 1 ? section.itemLabel : section.itemLabelPlural}
                </Text>
              </Box>
            ))}
          </Flex>
        </Box>

        <Box mb={8}>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            Search & Filter
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <FormControl>
              <FormLabel color="#55645a">Search by name</FormLabel>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${section.itemLabelPlural} by name`}
                bg="white"
              />
            </FormControl>
            <FormControl>
              <FormLabel color="#55645a">Filter by category</FormLabel>
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                bg="white"
              >
                <option value={ALL_CATEGORIES}>All categories</option>
                {sectionState.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </FormControl>
          </SimpleGrid>
          <Text mt={3} color="#55645a" fontSize="sm">
            Showing {filteredItems.length} of {sectionState.items.length}{" "}
            {section.itemLabelPlural}.
          </Text>
        </Box>

        <Box>
          <Text
            fontSize="sm"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color="#5e7a61"
            mb={4}
          >
            {section.title} List
          </Text>
          {filteredItems.length === 0 ? (
            <Box
              p={8}
              borderRadius="24px"
              border="1px solid rgba(43, 66, 47, 0.12)"
              bg="rgba(255,255,255,0.72)"
            >
              <Text fontWeight="700" color="#233127" mb={2}>
                No {section.itemLabelPlural} match this filter.
              </Text>
              <Text color="#55645a">
                Try another name or category filter, or create a new {section.itemLabel}.
              </Text>
            </Box>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={{ base: 4, md: 5 }}>
              {filteredItems.map((item) => {
                const isSelected = selectedSet.has(item.id);
                const mapObjectAsset = isObjectsSection
                  ? sanitizeMapObjectAsset(item.mapObjectAsset)
                  : undefined;

                return (
                  <Box
                    key={item.id}
                    as="div"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItem(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleItem(item.id);
                      }
                    }}
                    minH={{ base: "168px", md: "188px" }}
                    p={{ base: 4, md: 5 }}
                    borderRadius="24px"
                    borderWidth="2px"
                    borderColor={isSelected ? "#4b7a55" : "rgba(43, 66, 47, 0.12)"}
                    bg={
                      isSelected
                        ? "rgba(225, 241, 221, 0.95)"
                        : "linear-gradient(135deg, #fffdf6 0%, #edf4ea 100%)"
                    }
                    color="#213128"
                    cursor="pointer"
                    textAlign="left"
                    transition="transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
                    boxShadow={
                      isSelected
                        ? "0 18px 34px rgba(59, 78, 55, 0.16)"
                        : "0 14px 30px rgba(59, 78, 55, 0.08)"
                    }
                    _hover={{
                      transform: "translateY(-3px)",
                      borderColor: "rgba(43, 66, 47, 0.32)",
                      boxShadow: "0 18px 34px rgba(59, 78, 55, 0.14)",
                    }}
                  >
                    <Flex justify="space-between" align="flex-start" gap={4} mb={4}>
                      <Flex align="center" gap={3}>
                        <Box
                          w="56px"
                          h="56px"
                          borderRadius="18px"
                          overflow="hidden"
                          display="grid"
                          placeItems="center"
                          bg={
                            mapObjectAsset
                              ? "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(227,235,224,0.95) 100%)"
                              : "rgba(126, 166, 120, 0.12)"
                          }
                          color="#2e5b37"
                          flexShrink={0}
                        >
                          {mapObjectAsset ? (
                            <Box
                              as="img"
                              src={mapObjectAsset.imageSrc}
                              alt={`${item.name} preview`}
                              width={`${Math.max(20, Math.min(mapObjectAsset.width, 56))}px`}
                              height={`${Math.max(20, Math.min(mapObjectAsset.height, 56))}px`}
                              objectFit="contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                          ) : (
                            <DesignerIcon icon={section.icon} boxSize={8} />
                          )}
                        </Box>
                        <Box>
                          <Text fontSize="lg" fontWeight="700" mb={1}>
                            {item.name}
                          </Text>
                          <Badge
                            px={2.5}
                            py={1}
                            borderRadius="full"
                            bg="rgba(46, 91, 55, 0.12)"
                            color="#2e5b37"
                            textTransform="none"
                          >
                            {section.categoryLabel}: {item.category}
                          </Badge>
                        </Box>
                      </Flex>

                      <Badge
                        px={2.5}
                        py={1}
                        borderRadius="full"
                        bg={isSelected ? "#2e5b37" : "rgba(46, 91, 55, 0.08)"}
                        color={isSelected ? "white" : "#2e5b37"}
                        textTransform="none"
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Badge>
                    </Flex>

                    <Stack spacing={2}>
                      {item.details.map((itemDetail) => (
                        <Flex
                          key={`${item.id}-${itemDetail.label}`}
                          justify="space-between"
                          gap={4}
                        >
                          <Text fontSize="sm" color="#6d7b71">
                            {itemDetail.label}
                          </Text>
                          <Text fontSize="sm" fontWeight="700" color="#233127">
                            {itemDetail.value}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                    <Flex mt={4} justify="flex-end">
                      <IconButton
                        aria-label={`Edit ${item.name}`}
                        size="sm"
                        variant="outline"
                        borderColor="rgba(43, 66, 47, 0.24)"
                        color="#2e5b37"
                        icon={
                          <Icon viewBox="0 0 24 24" boxSize={4}>
                            <path
                              d="M4 20h4l10.5-10.5-4-4L4 16v4Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                            <path
                              d="m12.5 7.5 4 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </Icon>
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(item);
                        }}
                      />
                    </Flex>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </Box>

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        size={isObjectsSection ? "3xl" : "md"}
      >
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent borderRadius="24px">
          <ModalHeader>Add New {section.itemLabel}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={newItemName}
                  onChange={(event) => setNewItemName(event.target.value)}
                  placeholder={`Enter ${section.itemLabel} name`}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  value={newItemCategory}
                  onChange={(event) => setNewItemCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {isObjectsSection ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Image</FormLabel>
                    <Input
                      type="file"
                      accept=".png,.gif,image/png,image/gif"
                      onChange={(event) =>
                        handleMapObjectImageChange(event, setNewMapObjectImage)
                      }
                      p={1.5}
                    />
                    <Text mt={2} fontSize="sm" color="#55645a">
                      Upload a transparent PNG or GIF to use as the map object
                      sprite.
                    </Text>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl isRequired isInvalid={newMapObjectWidth !== "" && !hasValidMapObjectWidth}>
                      <FormLabel>Width</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={newMapObjectWidth}
                        onChange={(event) => setNewMapObjectWidth(event.target.value)}
                        placeholder="Width in pixels"
                      />
                    </FormControl>
                    <FormControl isRequired isInvalid={newMapObjectHeight !== "" && !hasValidMapObjectHeight}>
                      <FormLabel>Height</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={newMapObjectHeight}
                        onChange={(event) => setNewMapObjectHeight(event.target.value)}
                        placeholder="Height in pixels"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl isRequired>
                    <FormLabel>Map Object Type</FormLabel>
                    <Select
                      value={newMapObjectType}
                      onChange={(event) =>
                        setNewMapObjectType(event.target.value as DesignerMapObjectType)
                      }
                    >
                      {MAP_OBJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Box
                    p={4}
                    borderRadius="20px"
                    border="1px solid rgba(43, 66, 47, 0.12)"
                    bg="linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(241,246,238,0.95) 100%)"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      textTransform="uppercase"
                      letterSpacing="0.14em"
                      color="#5e7a61"
                      mb={3}
                    >
                      Preview
                    </Text>
                    <Flex
                      minH="220px"
                      align="center"
                      justify="center"
                      borderRadius="18px"
                      border="1px dashed rgba(43, 66, 47, 0.18)"
                      bgSize="20px 20px"
                      bgImage="linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07)), linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07))"
                      bgPosition="0 0, 10px 10px"
                    >
                      {newMapObjectImage ? (
                        <Box
                          as="img"
                          src={newMapObjectImage}
                          alt="Map object preview"
                          width={
                            hasValidMapObjectWidth
                              ? `${newMapObjectWidth}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          height={
                            hasValidMapObjectHeight
                              ? `${newMapObjectHeight}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          maxW="100%"
                          maxH="200px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <Text color="#6d7b71" textAlign="center" maxW="240px">
                          Upload a PNG or GIF to preview the map object with the
                          selected width and height.
                        </Text>
                      )}
                    </Flex>
                    <Text mt={3} fontSize="sm" color="#55645a">
                      Saved size:{" "}
                      {hasValidMapObjectWidth ? newMapObjectWidth : "--"} x{" "}
                      {hasValidMapObjectHeight ? newMapObjectHeight : "--"} px
                      • Type: {newMapObjectType}
                    </Text>
                  </Box>
                </>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleAddItem}
              isDisabled={!newItemName.trim() || !isMapObjectFormValid}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={closeEditModal}
        size={isObjectsSection ? "3xl" : "md"}
      >
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent borderRadius="24px">
          <ModalHeader>Edit {section.itemLabel}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={editItemName}
                  onChange={(event) => setEditItemName(event.target.value)}
                  placeholder={`Enter ${section.itemLabel} name`}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  value={editItemCategory}
                  onChange={(event) => setEditItemCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {isObjectsSection ? (
                <>
                  <FormControl isRequired>
                    <FormLabel>Image</FormLabel>
                    <Input
                      type="file"
                      accept=".png,.gif,image/png,image/gif"
                      onChange={(event) =>
                        handleMapObjectImageChange(event, setEditMapObjectImage)
                      }
                      p={1.5}
                    />
                    <Text mt={2} fontSize="sm" color="#55645a">
                      Upload a transparent PNG or GIF to replace the current map
                      object sprite.
                    </Text>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl
                      isRequired
                      isInvalid={editMapObjectWidth !== "" && !hasValidEditMapObjectWidth}
                    >
                      <FormLabel>Width</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editMapObjectWidth}
                        onChange={(event) => setEditMapObjectWidth(event.target.value)}
                        placeholder="Width in pixels"
                      />
                    </FormControl>
                    <FormControl
                      isRequired
                      isInvalid={editMapObjectHeight !== "" && !hasValidEditMapObjectHeight}
                    >
                      <FormLabel>Height</FormLabel>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={editMapObjectHeight}
                        onChange={(event) => setEditMapObjectHeight(event.target.value)}
                        placeholder="Height in pixels"
                      />
                    </FormControl>
                  </SimpleGrid>
                  <FormControl isRequired>
                    <FormLabel>Map Object Type</FormLabel>
                    <Select
                      value={editMapObjectType}
                      onChange={(event) =>
                        setEditMapObjectType(event.target.value as DesignerMapObjectType)
                      }
                    >
                      {MAP_OBJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <Box
                    p={4}
                    borderRadius="20px"
                    border="1px solid rgba(43, 66, 47, 0.12)"
                    bg="linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(241,246,238,0.95) 100%)"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      textTransform="uppercase"
                      letterSpacing="0.14em"
                      color="#5e7a61"
                      mb={3}
                    >
                      Preview
                    </Text>
                    <Flex
                      minH="220px"
                      align="center"
                      justify="center"
                      borderRadius="18px"
                      border="1px dashed rgba(43, 66, 47, 0.18)"
                      bgSize="20px 20px"
                      bgImage="linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07)), linear-gradient(45deg, rgba(46,91,55,0.07) 25%, transparent 25%, transparent 75%, rgba(46,91,55,0.07) 75%, rgba(46,91,55,0.07))"
                      bgPosition="0 0, 10px 10px"
                    >
                      {editMapObjectImage ? (
                        <Box
                          as="img"
                          src={editMapObjectImage}
                          alt="Map object preview"
                          width={
                            hasValidEditMapObjectWidth
                              ? `${editMapObjectWidth}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          height={
                            hasValidEditMapObjectHeight
                              ? `${editMapObjectHeight}px`
                              : `${DEFAULT_MAP_OBJECT_SIZE}px`
                          }
                          maxW="100%"
                          maxH="200px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <Text color="#6d7b71" textAlign="center" maxW="240px">
                          Upload a PNG or GIF to preview the map object with the
                          selected width and height.
                        </Text>
                      )}
                    </Flex>
                    <Text mt={3} fontSize="sm" color="#55645a">
                      Saved size:{" "}
                      {hasValidEditMapObjectWidth ? editMapObjectWidth : "--"} x{" "}
                      {hasValidEditMapObjectHeight ? editMapObjectHeight : "--"} px
                      • Type: {editMapObjectType}
                    </Text>
                  </Box>
                </>
              ) : null}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleEditItem}
              isDisabled={!editItemName.trim() || !isEditMapObjectFormValid}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)} size="2xl">
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent borderRadius="24px">
          <ModalHeader>Categories</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <Box
                p={4}
                borderRadius="18px"
                bg="rgba(126, 166, 120, 0.08)"
                border="1px solid rgba(43, 66, 47, 0.12)"
              >
                <Text fontWeight="700" color="#233127" mb={3}>
                  Add Category
                </Text>
                <Flex direction={{ base: "column", md: "row" }} gap={3}>
                  <Input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder={`Create a ${section.categoryLabel} folder`}
                    bg="white"
                  />
                  <Button
                    colorScheme="green"
                    onClick={handleAddCategory}
                    isDisabled={!newCategoryName.trim()}
                  >
                    Add
                  </Button>
                </Flex>
              </Box>

              <Box>
                <Text fontWeight="700" color="#233127" mb={3}>
                  Existing Categories
                </Text>
                <Stack spacing={3}>
                  {categorySummary.map((category) => {
                    const isEditing = editingCategory === category.name;
                    const isDeleting = deletingCategory === category.name;
                    const isLockedCategory = category.name === UNCATEGORIZED;

                    return (
                      <Box
                        key={category.name}
                        p={4}
                        borderRadius="18px"
                        border="1px solid rgba(43, 66, 47, 0.12)"
                        bg="rgba(255,255,255,0.78)"
                      >
                        <Flex
                          direction={{ base: "column", lg: "row" }}
                          justify="space-between"
                          align={{ base: "flex-start", lg: "center" }}
                          gap={4}
                        >
                          <Box flex="1">
                            {isEditing ? (
                              <Stack spacing={3}>
                                <Input
                                  value={editingCategoryName}
                                  onChange={(event) =>
                                    setEditingCategoryName(event.target.value)
                                  }
                                  placeholder="Rename category"
                                  bg="white"
                                />
                                <Flex wrap="wrap" gap={3}>
                                  <Button
                                    colorScheme="green"
                                    onClick={handleSaveCategory}
                                    isDisabled={!editingCategoryName.trim()}
                                  >
                                    Save
                                  </Button>
                                  <Button variant="ghost" onClick={cancelEditCategory}>
                                    Cancel
                                  </Button>
                                </Flex>
                              </Stack>
                            ) : (
                              <Box>
                                <Text fontWeight="700" color="#233127">
                                  {category.name}
                                </Text>
                                <Text fontSize="sm" color="#55645a">
                                  {category.count}{" "}
                                  {category.count === 1
                                    ? section.itemLabel
                                    : section.itemLabelPlural}
                                </Text>
                              </Box>
                            )}
                          </Box>

                          {!isEditing && (
                            <Flex wrap="wrap" gap={3}>
                              <Button
                                size="sm"
                                variant="outline"
                                borderColor="rgba(43, 66, 47, 0.24)"
                                onClick={() => startEditCategory(category.name)}
                                isDisabled={isLockedCategory}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                borderColor="rgba(145, 67, 53, 0.24)"
                                color="#914335"
                                onClick={() => startDeleteCategory(category.name)}
                                isDisabled={isLockedCategory}
                              >
                                Delete
                              </Button>
                            </Flex>
                          )}
                        </Flex>

                        {isDeleting && !isLockedCategory ? (
                          <Box
                            mt={4}
                            p={4}
                            borderRadius="16px"
                            bg="rgba(145, 67, 53, 0.06)"
                            border="1px solid rgba(145, 67, 53, 0.14)"
                          >
                            <Text fontWeight="700" color="#6e2f24" mb={2}>
                              Delete {category.name}?
                            </Text>
                            <Text fontSize="sm" color="#7b5147" mb={4}>
                              Existing {section.itemLabelPlural} in this category can move
                              into another category or become uncategorized.
                            </Text>
                            <FormControl mb={4}>
                              <FormLabel color="#7b5147">
                                Reassign existing items to
                              </FormLabel>
                              <Select
                                value={deleteCategoryTarget}
                                onChange={(event) =>
                                  setDeleteCategoryTarget(event.target.value)
                                }
                                bg="white"
                              >
                                {deleteCategoryOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <Flex wrap="wrap" gap={3}>
                              <Button colorScheme="red" onClick={handleDeleteCategory}>
                                Confirm Delete
                              </Button>
                              <Button variant="ghost" onClick={cancelDeleteCategory}>
                                Cancel
                              </Button>
                            </Flex>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setIsCategoriesOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)}>
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent borderRadius="24px">
          <ModalHeader>Move Selected Elements</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text color="#55645a">
                Move {selectedCount} selected{" "}
                {selectedCount === 1 ? section.itemLabel : section.itemLabelPlural} into
                a new category folder.
              </Text>
              <FormControl>
                <FormLabel>Target Category</FormLabel>
                <Select
                  value={moveCategory}
                  onChange={(event) => setMoveCategory(event.target.value)}
                >
                  {sectionState.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setIsMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleMoveSelected}
              isDisabled={selectedCount === 0}
            >
              Move Elements
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
