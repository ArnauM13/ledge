import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import type { TotpSetupResponse } from '@ledge/shared-types';
import { AuthService } from '../../auth/auth.service';
import { authErrorMessage } from '../../auth/errors';
import { AuthCard, BUTTON_CLASS, INPUT_CLASS } from './auth-card';

/**
 * Mandatory on the first login: scan the QR, confirm one code, then save
 * the recovery codes. The codes are shown only here, only once.
 */
@Component({
  selector: 'ledge-totp-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard],
  template: `
    <ledge-auth-card
      [heading]="
        recoveryCodes()
          ? 'Save your recovery codes'
          : 'Set up two-factor authentication'
      "
    >
      @if (recoveryCodes(); as codes) {
        <p class="t-mt-4 t-text-sm t-text-content-muted">
          Each code signs you in once if you lose your authenticator. They will
          not be shown again: store them in your password manager now.
        </p>
        <ol
          class="t-mt-4 t-grid t-grid-cols-1 t-gap-1 t-rounded-md t-border t-border-line t-bg-canvas t-p-3 t-font-mono t-text-sm"
          data-testid="recovery-codes"
        >
          @for (code of codes; track code) {
            <li>{{ code }}</li>
          }
        </ol>
        <button type="button" [class]="buttonClass" (click)="done()">
          I have saved them
        </button>
      } @else if (setup(); as s) {
        <p class="t-mt-4 t-text-sm t-text-content-muted">
          Scan this QR code with your authenticator app, then enter the code it
          shows.
        </p>
        <img
          class="t-mx-auto t-mt-4 t-rounded-md t-bg-white t-p-2"
          width="240"
          height="240"
          alt="QR code for the authenticator app"
          [src]="s.qrDataUrl"
        />
        <details class="t-mt-4 t-text-sm t-text-content-muted">
          <summary class="t-cursor-pointer">Can't scan it?</summary>
          <p class="t-mt-2">Enter this key manually:</p>
          <code
            class="t-mt-1 t-block t-break-all t-rounded t-bg-canvas t-p-2 t-font-mono t-text-content"
            >{{ s.secret }}</code
          >
        </details>
        <form class="t-mt-6" (submit)="confirm($event)" novalidate>
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
          @if (error()) {
            <p class="t-mt-4 t-text-sm t-text-negative" role="alert">
              {{ error() }}
            </p>
          }
          <button type="submit" [class]="buttonClass" [disabled]="busy()">
            Enable two-factor authentication
          </button>
        </form>
      } @else if (error()) {
        <p class="t-mt-4 t-text-sm t-text-negative" role="alert">
          {{ error() }}
        </p>
      } @else {
        <p class="t-mt-4 t-text-sm t-text-content-muted">Preparing…</p>
      }
    </ledge-auth-card>
  `,
})
export class TotpSetupPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly buttonClass = BUTTON_CLASS;
  protected readonly setup = signal<TotpSetupResponse | null>(null);
  protected readonly recoveryCodes = signal<string[] | null>(null);
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.setup.set(await this.auth.startTotpSetup());
    } catch (err) {
      this.error.set(authErrorMessage(err));
    }
  }

  protected async confirm(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.auth.confirmTotpSetup(this.code().trim());
      this.setup.set(null);
      this.recoveryCodes.set(res.recoveryCodes ?? []);
    } catch (err) {
      this.code.set('');
      (event.target as HTMLFormElement | null)?.reset();
      this.error.set(authErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async done(): Promise<void> {
    this.recoveryCodes.set(null);
    await this.router.navigateByUrl('/overview');
  }
}
