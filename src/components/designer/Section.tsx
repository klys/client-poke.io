import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
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
  const [sectionState, setSectionState] = useState<DesignerSectionState>(() =>
    loadStoredState(sectionKey)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(
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

  useEffect(() => {
    setSectionState(loadStoredState(sectionKey));
    setSelectedIds([]);
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
    moveCategory,
    newItemCategory,
    sectionState.categories,
  ]);

  const selectedCount = selectedIds.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
    setIsAddOpen(true);
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

  const handleAddItem = () => {
    const name = newItemName.trim();
    const category = normalizeCategoryName(newItemCategory) || UNCATEGORIZED;

    if (!name) {
      return;
    }

    setSectionState((current) => {
      const nextIndex = current.items.length + 1;
      const item: DesignerItemSeed = {
        id: `${section.key}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
        name,
        category,
        details: section.createDetails(name, category, nextIndex),
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

                return (
                  <Box
                    key={item.id}
                    as="button"
                    type="button"
                    onClick={() => toggleItem(item.id)}
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
                          display="grid"
                          placeItems="center"
                          bg="rgba(126, 166, 120, 0.12)"
                          color="#2e5b37"
                          flexShrink={0}
                        >
                          <DesignerIcon icon={section.icon} boxSize={8} />
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
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </Box>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} isCentered>
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
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleAddItem}
              isDisabled={!newItemName.trim()}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)} isCentered size="2xl">
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

      <Modal isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)} isCentered>
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
