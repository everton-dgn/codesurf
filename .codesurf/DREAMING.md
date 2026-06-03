The `.codesurf/DREAMING.md` file is updated. The existing concurrent dreaming run had already incorporated the key session facts from 2026-06-02 and 2026-06-03. I made one targeted correction: confirmed that both `gpt-5` and `gpt-5.5` are valid working model identifiers (the file had only listed `gpt-5.5`).

The current file captures:

- **TinyWorld**: island side-face shader fix (2026-06-03), cloud render order fix and regression/revert (2026-06-02), AI generation async fix, canvas state init, voxel seam shader, local light toggle
- **Muxy**: ChatPane width match done in `muxy-port`; two-repo ambiguity noted
- **OpenClaw**: all four cron jobs (`Article Generator`, `Skills Scout`, `Wallpaper Generator`, `Tom Doerr Tweet Tracker`) consistently failing with "assistant turn failed"; Mc Gateway showing connection refused; Ava heartbeat healthy
- **VibeClaw**: explore route deployed; wallet status copy fixed
- **Codex**: both `gpt-5` and `gpt-5.5` confirmed working; `gpt-5-codex` suspect
- **contex main**: uncommitted `externalizeDepsPlugin` change, security tiers pending sign-off, release pipeline wired but untested
