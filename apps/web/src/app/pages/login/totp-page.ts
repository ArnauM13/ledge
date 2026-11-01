import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { authErrorMessage } from '../../auth/errors';
import { AuthCard, BUTTON_CLASS, INPUT_CLASS, LINK_CLASS } from './auth-card';

/** Second step: the authenticator code, or a one-time recovery code. */
@Component({
  selector: 'ledge-totp-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard],
  template: `
    <ledge-auth-card heading="Two-factor authentication">
      <form class="t-mt-6" (submit)="submit($event)" novalidate>
        @if (useRecovery()) {
          <label class="t-block t-text-sm t-text-content-muted" for="code"
            >Recovery code</label
          >
          <input
            id="code"
            name="code"
            autocomplete="off"
            spellcheck="false"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            [class]="inputClass"
            [value]="code()"
            (input)="code.set($any($event.target).value)"
          />
          <p class="t-mt-2 t-text-xs t-text-content-subtle">
            Each recovery code works only once.
          </p>
        } @else {
          <label class="t-block t-text-sm t-text-content-muted" for="code"
            >Code from your authenticator app</label
          >
          <input
            id="code"
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            [class]="inputClass"
            [value]="code()"
            (input)="code.set($any($event.target).value)"
          />
        }
        @if (error()) {
          <p class="t-mt-4 t-text-sm t-text-negative" role="alert">
            {{ error() }}
          </p>
        }
        <button type="submit" [class]="buttonClass" [disabled]="busy()">
          Verify
        </button>
      </form>
      <button
        type="button"
        class="t-mt-4"
        [class]="linkClass"
        (click)="toggle()"
      >
        {{
          useRecovery() ? 'Use the authenticator app' : 'Use a recovery code'
        }}
      </button>
    </ledge-auth-card>
  `,
})
export class TotpPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly buttonClass = BUTTON_CLASS;
  protected readonly linkClass = LINK_CLASS;
  protected readonly code = signal('');
  protected readonly useRecovery = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected toggle(): void {
    this.useRecovery.update((v) => !v);
    this.code.set('');
    this.error.set(null);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.useRecovery()) {
        await this.auth.useRecoveryCode(this.code());
      } else {
        await this.auth.verifyTotp(this.code().trim());
      }
      await this.router.navigateByUrl('/overview');
    } catch (err) {
      this.code.set('');
      (event.target as HTMLFormElement | null)?.reset();
      this.error.set(authErrorMessage(err));
      // The pending session may be gone (expired or locked): re-check.
      const info = await this.auth.refresh();
      if (!('stage' in info) && !info.authenticated) {
        await this.router.navigateByUrl('/login');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
