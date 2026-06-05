export function copyText(s: string): void {
  void navigator.clipboard.writeText(s)
}
