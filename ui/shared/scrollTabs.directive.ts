import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from "@angular/core";

// Keeps a <tabset>'s tabs on one row that scrolls sideways when they don't fit, with ‹ › buttons
// at whichever edge has more tabs. The mouse wheel scrolls the row too (a plain wheel can't scroll
// sideways on its own), and the selected tab is kept in view.
@Directive({
  selector: "[appScrollTabs]",
})
export class ScrollTabsDirective implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private cleanup: (() => void)[] = [];

  ngAfterViewInit(): void {
    // Plain DOM work that doesn't change any Angular state, so keep it out of change detection
    this.zone.runOutsideAngular(() => this.setUp());
  }

  ngOnDestroy(): void {
    this.cleanup.forEach(fn => fn());
  }

  private setUp() {
    const list = this.host.nativeElement.querySelector<HTMLElement>("ul.nav-tabs");

    if (!list) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "scroll-tabs";
    list.parentElement.insertBefore(wrapper, list);
    wrapper.appendChild(list);

    const prev = this.makeButton("prev", "‹", "Scroll tabs left");
    const next = this.makeButton("next", "›", "Scroll tabs right");
    wrapper.append(prev, next);

    const update = () => {
      wrapper.classList.toggle("can-prev", list.scrollLeft > 1);
      wrapper.classList.toggle("can-next", list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
    };

    const scrollByPage = (direction: number) =>
      list.scrollBy({ left: direction * list.clientWidth * 0.7, behavior: "smooth" });

    const onWheel = (e: WheelEvent) => {
      if (list.scrollWidth > list.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        list.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    const showActiveTab = () => {
      const active = list.querySelector<HTMLElement>(".nav-link.active");

      if (!active) {
        return;
      }

      const left = active.offsetLeft - list.offsetLeft;
      const right = left + active.offsetWidth;

      // Leave room for the ‹ › buttons, which sit over the edges
      if (left < list.scrollLeft) {
        list.scrollTo({ left: left - 40, behavior: "smooth" });
      } else if (right > list.scrollLeft + list.clientWidth) {
        list.scrollTo({ left: right - list.clientWidth + 40, behavior: "smooth" });
      }
    };

    const onPrev = () => scrollByPage(-1);
    const onNext = () => scrollByPage(1);

    list.addEventListener("scroll", update, { passive: true });
    list.addEventListener("wheel", onWheel, { passive: false });
    prev.addEventListener("click", onPrev);
    next.addEventListener("click", onNext);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(list);

    // Tabs can be added later (one per game type), and the active one changes on click
    const mutationObserver = new MutationObserver(() => {
      update();
      showActiveTab();
    });
    mutationObserver.observe(list, { subtree: true, childList: true, attributeFilter: ["class"] });

    // The tab that's already selected when this opens needs to be shown too
    showActiveTab();
    update();

    this.cleanup.push(() => {
      list.removeEventListener("scroll", update);
      list.removeEventListener("wheel", onWheel);
      prev.removeEventListener("click", onPrev);
      next.removeEventListener("click", onNext);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  }

  private makeButton(kind: string, text: string, label: string) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `scroll-tabs-btn ${kind}`;
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.tabIndex = -1;
    return button;
  }
}
