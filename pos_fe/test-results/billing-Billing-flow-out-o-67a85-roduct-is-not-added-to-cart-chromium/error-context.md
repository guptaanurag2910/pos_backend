# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - img [ref=e10]
    - heading "BillSathi" [level=2] [ref=e14]
    - paragraph [ref=e15]: Choose your flow to continue
  - generic [ref=e16]:
    - button "Existing User Login" [ref=e17] [cursor=pointer]
    - button "New Store Setup" [ref=e18] [cursor=pointer]
  - generic [ref=e19]:
    - button "Login" [ref=e20] [cursor=pointer]
    - button "Change Password" [ref=e21] [cursor=pointer]
    - button "Forgot Password" [ref=e22] [cursor=pointer]
  - generic [ref=e23]:
    - img [ref=e24]
    - text: Invalid email or password
  - generic [ref=e26]:
    - generic [ref=e27]:
      - generic [ref=e28]: Email
      - generic [ref=e29]:
        - generic:
          - img
        - textbox "Email" [ref=e30]:
          - /placeholder: you@example.com
          - text: inv_mgr_1774120903647@example.com
    - generic [ref=e31]:
      - generic [ref=e32]: Password
      - generic [ref=e33]:
        - generic:
          - img
        - textbox "Password" [ref=e34]:
          - /placeholder: ••••••••
          - text: Manager@123
      - button "Forgot password?" [ref=e36] [cursor=pointer]
    - button "Sign in" [ref=e37] [cursor=pointer]
```