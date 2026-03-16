import { Component, computed, input, output, signal } from '@angular/core';

export interface MonthYear {
  month: number; // 0-indexed (0 = Jan)
  year: number;
}

@Component({
  selector: 'nsx-month-year-picker',
  standalone: true,
  template: `
    <button
      type="button"
      class="btn btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
      (click)="open()">
      <span class="font-monospace" [class.text-muted]="!value()">
        {{ displayValue() }}
      </span>
      <small class="text-muted">&#9662;</small>
    </button>

    @if (isOpen()) {
      <div class="nsx-myp-backdrop" (click)="cancel()"></div>
      <div class="nsx-myp-popup border rounded shadow">

        <div class="d-flex justify-content-between align-items-center px-3 py-2 bg-body-tertiary border-bottom">
          <span class="text-uppercase text-muted fw-semibold" style="font-size: 10px; letter-spacing: .08em;">
            {{ label() }}
          </span>
          <span class="font-monospace fw-semibold">{{ preview() }}</span>
        </div>

        <div class="nsx-myp-body">
          <!-- Months: 6 rows × 2 cols -->
          <div class="nsx-myp-section">
            <div class="text-uppercase text-muted px-1 mb-1" style="font-size: 10px; letter-spacing: .08em;">Month</div>
            <div class="nsx-myp-grid nsx-myp-grid-2">
              @for (month of MONTHS; track $index) {
                <button
                  type="button"
                  class="btn btn-sm w-100"
                  [class.btn-success]="isSelectedMonth($index)"
                  [class.btn-outline-success]="isCurrentMonth($index) && !isSelectedMonth($index)"
                  [class.btn-light]="!isSelectedMonth($index) && !isCurrentMonth($index)"
                  (click)="selectMonth($index)">
                  {{ month }}
                </button>
              }
            </div>
          </div>

          <!-- Years: 5 rows × 2 cols + nav row -->
          <div class="nsx-myp-section">
            <div class="text-uppercase text-muted px-1 mb-1" style="font-size: 10px; letter-spacing: .08em;">Year</div>
            <div class="nsx-myp-grid nsx-myp-grid-2">
              @for (year of years(); track year) {
                <button
                  type="button"
                  class="btn btn-sm w-100 font-monospace"
                  [class.btn-success]="isSelectedYear(year)"
                  [class.btn-outline-success]="isCurrentYear(year) && !isSelectedYear(year)"
                  [class.btn-light]="!isSelectedYear(year) && !isCurrentYear(year)"
                  (click)="selectYear(year)">
                  {{ year }}
                </button>
              }
              <button type="button" class="btn btn-sm btn-light w-100" (click)="shiftYears(-10)">
                &lsaquo;
              </button>
              <button type="button" class="btn btn-sm btn-light w-100" (click)="shiftYears(10)">
                &rsaquo;
              </button>
            </div>
          </div>
        </div>

        <div class="row g-0 border-top">
          <div class="col border-end">
            <button
              type="button"
              class="btn btn-light w-100 rounded-0 py-2"
              (click)="cancel()">
              Cancel
            </button>
          </div>
          <div class="col">
            <button
              type="button"
              class="btn w-100 rounded-0 py-2 fw-semibold text-success"
              (click)="confirm()">
              OK
            </button>
          </div>
        </div>

      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: block; }
    .nsx-myp-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1050;
    }
    .nsx-myp-popup {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 1051;
      background: white;
      width: 340px;
      max-width: 92vw;
      overflow: hidden;
    }
    .nsx-myp-body {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem;
    }
    .nsx-myp-section {
      flex: 1;
      min-width: 0;
    }
    .nsx-myp-grid {
      display: grid;
      gap: 3px;
    }
    .nsx-myp-grid-2 {
      grid-template-columns: 1fr 1fr;
    }
  `],
})
export class MonthYearPickerComponent {
  label = input<string>('Select date');
  value = input<MonthYear | null>(null);
  valueChange = output<MonthYear>();

  readonly MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  private readonly today = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  };

  isOpen    = signal(false);
  tempMonth = signal<number | null>(null);
  tempYear  = signal<number | null>(null);
  yearStart = signal(this.today.year - 3);

  years = computed(() =>
    Array.from({ length: 10 }, (_, i) => this.yearStart() + i)
  );

  displayValue = computed(() => {
    const v = this.value();
    return v ? `${this.MONTHS[v.month]} ${v.year}` : '— / —';
  });

  preview = computed(() => {
    const m = this.tempMonth();
    const y = this.tempYear();
    if (m !== null && y !== null) return `${this.MONTHS[m]} ${y}`;
    if (m !== null) return `${this.MONTHS[m]} —`;
    if (y !== null) return `— ${y}`;
    return '';
  });

  open(): void {
    const v = this.value();
    this.tempMonth.set(v?.month ?? this.today.month);
    this.tempYear.set(v?.year ?? this.today.year);
    this.isOpen.set(true);
  }

  selectMonth(m: number): void { this.tempMonth.set(m); }
  selectYear(y: number): void  { this.tempYear.set(y); }
  shiftYears(delta: number): void { this.yearStart.update(s => s + delta); }

  confirm(): void {
    const m = this.tempMonth();
    const y = this.tempYear();
    if (m === null || y === null) return;
    this.valueChange.emit({ month: m, year: y });
    this.isOpen.set(false);
  }

  cancel(): void { this.isOpen.set(false); }

  isSelectedMonth(m: number): boolean { return this.tempMonth() === m; }
  isSelectedYear(y: number): boolean  { return this.tempYear() === y; }
  isCurrentMonth(m: number): boolean  { return m === this.today.month; }
  isCurrentYear(y: number): boolean   { return y === this.today.year; }
}
