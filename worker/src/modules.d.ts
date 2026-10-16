// wrangler は .html を文字列として読み込む
declare module '*.html' {
  const content: string;
  export default content;
}
