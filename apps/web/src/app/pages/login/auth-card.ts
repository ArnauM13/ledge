import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Centered card shared by the sign-in screens. */
@Component({
  selector: 'ledge-auth-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="t-flex t-min-h-screen t-items-center t-justify-center t-px-4 t-py-10"
    >
      <section
        class="t-w-full t-max-w-sm t-rounded-xl t-border t-border-line t-bg-surface t-p-6 md:t-p-8"
      >
        <p class="t-text-lg t-font-semibold t-tracking-tight">ledge</p>
        <h1 class="t-mt-6 t-text-xl t-font-semibold t-tracking-tight">
          {{ heading() }}
        </h1>
        <ng-content />
      </section>
    </main>
  `,
})
export class AuthCard {
  readonly heading = input.required<string>();
}

/** Tailwind classes shared by the form controls. */
export const INPUT_CLASS =
  't-mt-1 t-block t-w-full t-rounded-md t-border t-border-line t-bg-canvas t-px-3 t-py-2 t-text-sm t-text-content placeholder:t-text-content-subtle focus:t-border-content-muted focus:t-outline-none';
export const BUTTON_CLASS =
  't-mt-6 t-w-full t-rounded-md t-bg-content t-px-3 t-py-2 t-text-sm t-font-medium t-text-canvas hover:t-bg-content-muted disabled:t-opacity-50';
export const LINK_CLASS =
  't-text-sm t-text-content-muted t-underline hover:t-text-content';
