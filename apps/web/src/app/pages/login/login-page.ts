import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { authErrorMessage } from '../../auth/errors';
import { AuthCard, BUTTON_CLASS, INPUT_CLASS } from './auth-card';

@Component({
  selector: 'ledge-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthCard],
  template: `
    <ledge-auth-card heading="Sign in">
      <form class="t-mt-6" (submit)="submit($event)" novalidate>
        <label class="t-block t-text-sm t-text-content-muted" for="email"
          >Email</label
        >
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="username"
          required
          [class]="inputClass"
          [value]="email()"
          (input)="email.set($any($event.target).value)"
        />
        <label
          class="t-mt-4 t-block t-text-sm t-text-content-muted"
          for="password"
          >Password</label
        >
        <input
          #passwordInput
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          [class]="inputClass"
          [value]="password()"
          (input)="password.set($any($event.target).value)"
        />
        @if (error()) {
          <p class="t-mt-4 t-text-sm t-text-negative" role="alert">
            {{ error() }}
          </p>
        }
        <button type="submit" [class]="buttonClass" [disabled]="busy()">
          Continue
        </button>
      </form>
    </ledge-auth-card>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly buttonClass = BUTTON_CLASS;
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly passwordInput =
    viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  /** Clears the password from the signal and the DOM (the binding may not re-run). */
  private clearPassword(): void {
    this.password.set('');
    this.passwordInput().nativeElement.value = '';
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.auth.login(this.email(), this.password());
      this.clearPassword();
      await this.router.navigateByUrl(
        res.next === 'totp' ? '/login/totp' : '/login/totp-setup',
      );
    } catch (err) {
      this.clearPassword();
      this.error.set(authErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
