type ScrollRegion = {
  scrollTop: number;
  getBoundingClientRect: () => { top: number };
};
type ScrollTarget = { getBoundingClientRect: () => { top: number } };

/** Reveal the answer's beginning without scrolling the app or relying on nested offset parents. */
export function revealAssistantReply(
  region: ScrollRegion,
  target: ScrollTarget,
) {
  region.scrollTop = Math.max(
    0,
    region.scrollTop +
      target.getBoundingClientRect().top -
      region.getBoundingClientRect().top -
      20,
  );
}
