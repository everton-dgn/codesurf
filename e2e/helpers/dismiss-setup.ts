import type { Page } from '@playwright/test'

export async function dismissAgentSetupIfPresent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const needsSetup = await window.electron.agentPaths?.needsSetup?.()
    if (needsSetup) {
      await window.electron.agentPaths?.confirmAll?.()
    }

    const settings = await window.electron.settings.get()
    if (!settings.onboardingComplete) {
      await window.electron.settings.set({
        ...settings,
        onboardingComplete: true,
      })
    }
  })

  const looksGood = page.getByRole('button', { name: 'Looks good' })
  if (await looksGood.isVisible().catch(() => false)) {
    await looksGood.click()
  }

  const getStarted = page.getByRole('button', { name: /Get started/i })
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click()
  }
}