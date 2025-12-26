import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MyEnvironmentModel } from './my-environment.model';



@NgModule({
    declarations: [],
    imports: [
        CommonModule
    ]
})
export class NgxStoneScriptPhpClientModule {
    public static forRoot(environment: MyEnvironmentModel): ModuleWithProviders<NgxStoneScriptPhpClientModule> {
        return {
            ngModule: NgxStoneScriptPhpClientModule,
            providers: [
                { provide: MyEnvironmentModel, useValue: environment }
            ]
        }
    }
}
