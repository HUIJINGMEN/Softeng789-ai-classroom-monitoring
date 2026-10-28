let openDialogCount = 0;
let previousLock: string | undefined;

/** Shared by standard modals and mobile sheets; nested dialogs release only their own lock. */
export function lockDialogScroll(): () => void {
  if (openDialogCount === 0) {
    previousLock = document.body.dataset.modalScrollLock;
    document.body.dataset.modalScrollLock = 'true';
  }
  openDialogCount++;
  return () => {
    openDialogCount = Math.max(0, openDialogCount - 1);
    if (openDialogCount !== 0) return;
    if (previousLock === undefined) delete document.body.dataset.modalScrollLock;
    else document.body.dataset.modalScrollLock = previousLock;
  };
}
