/** Fire this anywhere to open the order modal */
export function openOrderModal() {
  window.dispatchEvent(new CustomEvent("openOrderModal"));
}
