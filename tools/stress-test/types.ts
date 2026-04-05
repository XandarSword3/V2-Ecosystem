import { ApiClient } from './utils/api-client';
import { Logger } from './utils/logger';

export interface ScenarioResult {
    name: string;
    success: boolean;
    invariantHeld: boolean;
    details: string;
    metrics: {
        duration: number;
        requests: number;
        failures: number;
    };
}

export interface InvariantScenario {
    name: string;
    description: string;

    setup(api: ApiClient, logger: Logger): Promise<void>;
    run(api: ApiClient, logger: Logger): Promise<void>;
    verify(api: ApiClient, logger: Logger): Promise<boolean>;
    teardown(api: ApiClient, logger: Logger): Promise<void>;
    getResult(): ScenarioResult;
}
