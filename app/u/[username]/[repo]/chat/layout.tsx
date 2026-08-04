/**
 * The chat is the one route where the page itself does not scroll.
 *
 * The fixed-height shell lives in the layout rather than the page so that loading,
 * not-found and error states share it. When it sat in page.tsx, the loading skeleton
 * rendered with the old scrolling layout and the view jolted as the real content arrived.
 *
 * `dvh` rather than `vh`: mobile browser chrome changes the viewport height as it
 * collapses, and `vh` would leave the composer sitting underneath it.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  /*
   * `data-chat-shell` is the hook globals.css uses to lock html/body scrolling for this
   * route only. Sizing this element alone is not enough: the root layout gives html
   * `h-full` and body `min-h-full`, and those percentages resolve against the large
   * viewport, so the document stays taller than the visible area and scrolls underneath.
   */
  return (
    <div data-chat-shell className="flex h-dvh flex-col overflow-hidden">
      {children}
    </div>
  );
}
