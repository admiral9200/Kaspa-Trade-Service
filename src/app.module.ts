import {Module} from '@nestjs/common';
import {BackendModule} from "./modules/backend/backend.module";
import {CoreModule} from "./modules/core/core.module";
import {AppConfigModule} from "./modules/core/modules/config/app-config.module";

@Module({
    imports: [
        CoreModule,
        BackendModule
    ],
    providers: [],
})
export class AppModule {
}
