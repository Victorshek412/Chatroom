import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const isFocusableElement = (element) =>
  element instanceof HTMLElement &&
  element.getAttribute("aria-hidden") !== "true" &&
  !element.hasAttribute("disabled") &&
  element.getClientRects().length > 0;

const getFocusableElements = (container) =>
  Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) =>
    isFocusableElement(element) &&
    !element.closest("[aria-hidden='true']"),
  );

const focusElement = (element) => {
  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
};

function useFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
  onClose,
}) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInitialElement = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const requestedInitialFocus = initialFocusRef?.current;
      if (
        requestedInitialFocus &&
        container.contains(requestedInitialFocus) &&
        isFocusableElement(requestedInitialFocus)
      ) {
        focusElement(requestedInitialFocus);
        return;
      }

      const focusableElements = getFocusableElements(container);
      focusElement(focusableElements[0] || container);
    };

    const frameId = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusElement(container);
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!container.contains(activeElement)) {
        event.preventDefault();
        focusElement(event.shiftKey ? lastElement : firstElement);
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        focusElement(lastElement);
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        focusElement(firstElement);
      }
    };

    const handleFocusIn = (event) => {
      const container = containerRef.current;
      if (!container || container.contains(event.target)) {
        return;
      }

      const requestedInitialFocus = initialFocusRef?.current;
      if (
        requestedInitialFocus &&
        container.contains(requestedInitialFocus) &&
        isFocusableElement(requestedInitialFocus)
      ) {
        focusElement(requestedInitialFocus);
        return;
      }

      const focusableElements = getFocusableElements(container);
      focusElement(focusableElements[0] || container);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);

      const previousActiveElement = previousActiveElementRef.current;
      previousActiveElementRef.current = null;

      if (previousActiveElement?.isConnected) {
        focusElement(previousActiveElement);
      }
    };
  }, [containerRef, initialFocusRef, isOpen, onClose]);
}

export default useFocusTrap;
