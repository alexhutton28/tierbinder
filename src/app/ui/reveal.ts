// Scrolls what just opened into view: the sidebar's tab panel, which scrolls on its own at
// every width. Only scrolls down, only as far as needed to show it with REVEAL_MARGIN under
// it, and never past the top of `el`, so whatever opened it stays in sight when it's taller
// than the panel.

const REVEAL_MARGIN = 16;
// The longest a disclosure takes to slide open (past --duration-drop), in case its
// transitionend never comes (a hidden tab)
const OPEN_WAIT = 600;

function scroller(el: HTMLElement) {
  let box = el.parentElement;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  return box;
}

// How far to scroll down to show `el` as it is now
function hiddenBelow(el: HTMLElement, box: HTMLElement) {
  const { top, bottom } = el.getBoundingClientRect();
  const view = box.getBoundingClientRect();
  return Math.min(bottom + REVEAL_MARGIN - view.bottom, top - view.top);
}

// Something that appeared at once (Card Tray's rows): a smooth scroll to it, unless motion
// is reduced
export function revealBelow(el: HTMLElement) {
  const box = scroller(el);
  if (!box) return;
  const hidden = hiddenBelow(el, box);
  if (hidden <= 0) return;
  box.scrollBy({
    top: hidden,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

// A disclosure sliding open (Bulk Import): the panel follows its foot down each frame as it
// grows, since it can't scroll to where the foot will be until the panel is that tall
export function followOpen(el: HTMLElement) {
  const box = scroller(el);
  if (!box) return;
  let frame = 0;
  const follow = () => {
    const hidden = hiddenBelow(el, box);
    if (hidden > 0) box.scrollTop += hidden;
    frame = requestAnimationFrame(follow);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    el.removeEventListener('transitionend', onEnd);
    // Its final size, once more
    const hidden = hiddenBelow(el, box);
    if (hidden > 0) box.scrollTop += hidden;
  };
  const onEnd = (e: TransitionEvent) => {
    if (e.target === el && e.propertyName === 'grid-template-rows') stop();
  };
  el.addEventListener('transitionend', onEnd);
  const timer = setTimeout(stop, OPEN_WAIT);
  frame = requestAnimationFrame(follow);
}

// The longest a smooth scroll back to the top is waited for, where neither the top nor
// scrollend comes (a hidden tab)
const TOP_WAIT = 800;

// Scrolls a panel back to its top (smoothly, unless motion is reduced), then runs `then`:
// what changes the panel's contents (clearing the search) waits until it's there, so the
// scroll isn't cut short by the panel shrinking under it. Done once the top is reached
// (Safari has no scrollend), at scrollend, or after TOP_WAIT
export function toTopThen(box: HTMLElement, then: () => void) {
  if (box.scrollTop <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    box.scrollTop = 0;
    then();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    box.removeEventListener('scroll', onScroll);
    box.removeEventListener('scrollend', finish);
    clearTimeout(timer);
    then();
  };
  const onScroll = () => {
    if (box.scrollTop <= 0) finish();
  };
  box.addEventListener('scroll', onScroll);
  box.addEventListener('scrollend', finish);
  const timer = setTimeout(finish, TOP_WAIT);
  box.scrollTo({ top: 0, behavior: 'smooth' });
}
