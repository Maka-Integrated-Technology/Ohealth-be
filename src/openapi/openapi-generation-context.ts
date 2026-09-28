let contractGenerationEnabled = false;

export function enableOpenApiContractGeneration(): void {
  contractGenerationEnabled = true;
}

export function isOpenApiContractGenerationEnabled(): boolean {
  return contractGenerationEnabled;
}
