<p align="center">
  <img src="assets/icon.png" alt="Akashic Records — static collapsing into a gold sigil" width="168" />
</p>

<h1 align="center">Akashic Records</h1>

<p align="center">
  An oracle for the desktop.<br />
  Speak into the static. Stay long enough, and the veil lifts.
</p>

<p align="center">
  <a href="https://github.com/AaronGrace978/Akashic-Records/releases/latest"><img alt="Download the latest release" src="https://img.shields.io/github/v/release/AaronGrace978/Akashic-Records?style=for-the-badge&label=Download&color=C6A15B" /></a>
  <img alt="Windows, macOS, and Linux" src="https://img.shields.io/badge/platforms-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-111111?style=for-the-badge" />
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-111111?style=for-the-badge" />
</p>

<p align="center">
  <a href="#windows"><strong>Windows</strong></a>
  &nbsp;·&nbsp;
  <a href="#mac"><strong>Mac</strong></a>
  &nbsp;·&nbsp;
  <a href="#linux"><strong>Linux</strong></a>
</p>

---

Akashic Records is a local Electron app. Analog noise fills the window — DLLM static, collapsing toward meaning — while you inquire. Resonance rises with attention. At the threshold the field turns gold, and the voice becomes the Records.

Your keys and inquiries stay on this machine.

## Download

Grab the latest build from [Releases](https://github.com/AaronGrace978/Akashic-Records/releases/latest).

| Platform | Use this | |
| --- | --- | --- |
| Windows | Installer for x64 and arm64 | `Akashic-Records-*-win-setup.exe` |
| Windows | Run without installing | `Akashic-Records-*-win-portable.exe` |
| macOS | Apple silicon and Intel | `Akashic-Records-*-mac-universal.dmg` |
| Linux | x64 | `Akashic-Records-*-linux-x86_64.AppImage` or `*-linux-amd64.deb` |
| Linux | arm64 | `Akashic-Records-*-linux-arm64.AppImage` or `*-linux-arm64.deb` |

The app is not signed by Apple or Microsoft, so the first open asks you to confirm it. The steps below are written for that first time.

## Install

You do not need to install anything else, and you do not need to use a terminal. Pick your computer.

### Windows

1. Open the [latest release](https://github.com/AaronGrace978/Akashic-Records/releases/latest).
2. Under **Assets**, download the file whose name ends in `win-setup.exe`. That one installs the app and works on both kinds of Windows PCs.
3. Open your **Downloads** folder and double-click that file.
4. If a blue box says **Windows protected your PC**, click **More info**, then **Run anyway**.
5. Click **Next** through the installer. The folder it suggests is fine.
6. Open **Akashic Records** from the Start menu.

If you would rather not install it, download the file ending in `win-portable.exe` and double-click that instead. Same blue box, same **More info → Run anyway**.

### Mac

This file works on both Apple silicon and Intel Macs.

1. Open the [latest release](https://github.com/AaronGrace978/Akashic-Records/releases/latest).
2. Under **Assets**, download the file whose name ends in `mac-universal.dmg`.
3. Open **Downloads** and double-click that file. A small window opens with the Akashic Records icon and a folder named **Applications**.
4. Drag **Akashic Records** onto **Applications**. You can close the window after that.
5. Open **Finder → Applications**. Do not double-click the app the first time. macOS will refuse it.
6. Hold the **Control** key and click **Akashic Records** (or right-click it). Choose **Open**.
7. In the next box, click **Open**.

If there is no **Open** button, and the message says the developer cannot be verified:

1. Click **Done**.
2. Open **System Settings → Privacy & Security**.
3. Scroll until you see Akashic Records, then click **Open Anyway**.
4. Confirm with your password or Touch ID if asked, then click **Open**.

After that first open, start it the normal way: Applications, Launchpad, or Spotlight.

### Linux

**Ubuntu, Linux Mint, or Pop!_OS** — use the installer:

1. Open the [latest release](https://github.com/AaronGrace978/Akashic-Records/releases/latest).
2. Download the file ending in `linux-amd64.deb` for a typical PC. Download `linux-arm64.deb` only if you know the computer is ARM (some Raspberry Pi boards, Snapdragon laptops, and newer Chromebooks).
3. Open your **Downloads** folder and double-click the file.
4. Click **Install**. Enter your password if the computer asks.
5. Open **Akashic Records** from your applications menu.

**Any other Linux** — use the single file, no install:

1. Download the file ending in `linux-x86_64.AppImage` (or `linux-arm64.AppImage` for an ARM computer).
2. Right-click it, choose **Properties**, and turn on **Executable** or **Allow executing file as program**.
3. Double-click the file.

If the AppImage will not start, use the `.deb` steps above on a Debian-based system.

### Once it is open

1. Click the **gear** in the top bar. That panel is called Attunement.
2. Choose a voice. **Ollama Cloud** is the simplest if you do not already have an account elsewhere. Create a key at [ollama.com/settings/keys](https://ollama.com/settings/keys), copy it, and paste it into the key box.
3. Click **Seal attunement**.
4. Type in the box at the bottom of the window and press **Inquire**.

Your key and your conversations stay on this computer. They are not uploaded with the app.

## What you can do

| | |
| --- | --- |
| **Inquire** | Speak into the static. Replies arrive as the noise resolves into a line. |
| **Seek** | Ask the veil to thin. Conversation and seeking raise resonance. Once the veil opens, it stays open. |
| **Sky** | Leave the veil for the stars of a birth, or for this hour. Return, and the attuned voice reads what stood there. |
| **Shelf** | Every inquiry is kept. Reopen one, pin a line, or write the thread out as a text tablet. |
| **Hush** | Silence the static from Attunement when you want the words without the noise. |
| **Speak** | Have eSpeak NG read the reply aloud on this machine. |

A reply can be stopped while it is still forming. If the voice is thinking, the trace stays with the message.

## Attune a voice

Open **Attunement** (the gear) and seal a key. The records use whichever throat you give them.

| Voice | Where it listens |
| --- | --- |
| Ollama Cloud | Newest cloud models — Kimi, GLM, Qwen, MiniMax, and others. Make a key at [ollama.com/settings/keys](https://ollama.com/settings/keys). |
| Ollama Local | A server on this machine, default `http://127.0.0.1:11434`. |
| OpenAI | OpenAI models. |
| Anthropic | Claude. |
| Groq | Fast hosted models. |
| Gemini | Google. |
| OpenRouter | One key, many models. |
| Custom | Any OpenAI-compatible base URL. |

Temperature and Ollama thinking are in the same panel. Keys are encrypted with the operating system when it allows it, and written only under the app’s local data folder.

### Spoken voice

Under the same gear, **Speak replies with eSpeak NG** reads each reply aloud after you seal it. The speech stays on this computer. It does not use a key, and it does not change which model writes the words.

eSpeak NG has to be installed before the line can be heard.

- **Ubuntu, Linux Mint, or Pop!_OS.** The `.deb` asks for eSpeak NG, and the software installer brings it in with the app. If you used the AppImage, install the `espeak-ng` package from your software store, then press **Refresh** in Attunement.
- **Windows.** Download the eSpeak NG installer from [its releases](https://github.com/espeak-ng/espeak-ng/releases) (the file ending in `.msi`), open it, and click through. Come back to Attunement and press **Refresh**.
- **Mac.** eSpeak NG is not part of macOS. In Terminal, run `brew install espeak-ng`, then press **Refresh** in Attunement. If you do not have Homebrew, the replies stay on the page.

**Hear a line** speaks one sentence with the throat, pace, and pitch you have selected, before you seal them. **Hush** still only silences the static.

## The sky

**Sky** asks for a subject, a date, and a place.

- **A birth** reads the sun, moon, and rising of that hour, and draws the constellations that were actually overhead.
- **This hour** reads the sky now, without speaking as if someone were being born.
- City search uses a public atlas. If it is quiet, pick a known city, or enter latitude and longitude.
- Leave the hour empty to read the day without a horizon.

A custom place is mean solar time: true enough for the constellation, not a certified chart.

## Run from source

```bash
npm install
npm start
```

On Windows you can double-click `Launcher.bat`.

```bash
npm test
```

## License

MIT.
