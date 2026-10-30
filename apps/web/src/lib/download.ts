export function download(
  name: string,
  content: string,
  mime = "text/plain;charset=utf-8"
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function printHtml(content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/html;charset=utf-8" })
  );
  const frame = document.createElement("iframe");
  frame.title = "Print report";
  frame.style.cssText =
    "position:fixed;width:1px;height:1px;bottom:0;opacity:0;pointer-events:none";
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  frame.src = url;
  document.body.append(frame);
}
