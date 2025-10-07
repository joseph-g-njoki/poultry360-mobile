/**
 * useOptimizedFlatList Hook
 * Provides optimized FlatList configuration for better performance
 */

import { useMemo, useCallback } from 'react';

/**
 * Hook for optimized FlatList configuration
 * @param {number} itemHeight - Average item height in pixels
 * @param {object} options - Additional options
 * @returns {object} - Optimized FlatList props
 */
export const useOptimizedFlatList = (itemHeight = 200, options = {}) => {
  const {
    maxToRenderPerBatch = 10,
    updateCellsBatchingPeriod = 50,
    initialNumToRender = 10,
    windowSize = 10,
  } = options;

  // Memoized key extractor
  const keyExtractor = useCallback((item, index) => {
    if (item?.id) {
      return item.id.toString();
    }
    return `item_${index}`;
  }, []);

  // Memoized getItemLayout for fixed height items
  const getItemLayout = useCallback(
    (data, index) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );

  // Memoized FlatList props
  // CRASH FIX: Don't include useCallback functions (keyExtractor, getItemLayout) in dependencies
  // They're stable and including them causes infinite loops
  const flatListProps = useMemo(
    () => ({
      // Performance optimizations
      removeClippedSubviews: true, // Remove offscreen views from memory
      maxToRenderPerBatch, // Reduce number rendered per batch
      updateCellsBatchingPeriod, // Delay between batch renders
      initialNumToRender, // Number to render initially
      windowSize, // Number of screens to render

      // Layout optimizations
      keyExtractor,
      getItemLayout,

      // Scroll optimizations
      scrollEventThrottle: 16, // Throttle scroll events (60fps)
    }),
    [
      maxToRenderPerBatch,
      updateCellsBatchingPeriod,
      initialNumToRender,
      windowSize,
      itemHeight,
    ]
  );

  return flatListProps;
};

/**
 * Hook for variable height items (less optimized but safer)
 * @param {object} options - FlatList options
 * @returns {object} - FlatList props for variable height
 */
export const useVariableHeightFlatList = (options = {}) => {
  const {
    maxToRenderPerBatch = 10,
    updateCellsBatchingPeriod = 50,
    initialNumToRender = 10,
    windowSize = 10,
  } = options;

  const keyExtractor = useCallback((item, index) => {
    if (item?.id) {
      return item.id.toString();
    }
    return `item_${index}`;
  }, []);

  // CRASH FIX: Don't include keyExtractor in dependencies - it's a stable useCallback
  const flatListProps = useMemo(
    () => ({
      removeClippedSubviews: true,
      maxToRenderPerBatch,
      updateCellsBatchingPeriod,
      initialNumToRender,
      windowSize,
      keyExtractor,
      scrollEventThrottle: 16,
    }),
    [maxToRenderPerBatch, updateCellsBatchingPeriod, initialNumToRender, windowSize]
  );

  return flatListProps;
};

export default useOptimizedFlatList;
