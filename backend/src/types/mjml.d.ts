declare module "mjml" {
  const mjml2html: (mjml: string) => { html: string; errors: any[] };
  export default mjml2html;
}
