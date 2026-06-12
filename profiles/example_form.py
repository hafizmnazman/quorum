"""Example Quorum profile. Copy this file to add a new form.

How to make one for your own form:

1. Run:  playwright codegen "https://your-form-host.example/your-form-id"
2. Click through the form once in the recorder window.
3. Paste the generated `page.*` lines into fill() below, but SKIP:
     - the `page.goto(...)` line          (the engine navigates for you)
     - the final Submit button click      (the engine clicks Submit for you)
4. Set NAME and URL, save the file in profiles/, and hit Reload in the UI.

Tip: randomize at least one free-text answer (like below) so submissions
aren't byte-identical.
"""

import random

NAME = "Example form"
URL = "https://your-form-host.example/EXAMPLE"

FLAVORS = ["mint", "mango", "vanilla", "matcha", "espresso", "raspberry"]


def fill(page):
    # Pasted from `playwright codegen`, minus goto and the Submit click.
    page.get_by_role("radio", name="Yes").check()
    page.get_by_role("textbox", name="What's your favorite flavor?").fill(
        f"{random.choice(FLAVORS)} pick #{random.randint(1, 999)}"
    )
