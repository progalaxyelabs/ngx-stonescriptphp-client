import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MyEnvironmentModel } from '../my-environment.model';



@NgModule({
    declarations: [],
    imports: [
        CommonModule
    ]
})
export class ProgalaxyClientCommonModule {
    public static forRoot(environment: MyEnvironmentModel): ModuleWithProviders<ProgalaxyClientCommonModule> {
        return {
            ngModule: ProgalaxyClientCommonModule,
            providers: [
                { provide: MyEnvironmentModel, useValue: environment }
            ]
        }
    }
}
