import xss from "xss"

export const generateSvg = (options: {
  style: string
  icon?: string
  title?: string
  url: string
  description?: string
  provider?: string
}) => {
  const style = options.style
  const icon = options.icon && xss(options.icon)
  const title = options.title && xss(options.title)
  const url = xss(options.url)
  const description = options.description && xss(options.description)
  const provider = options.provider && xss(options.provider)
  return `
<svg xmlns='http://www.w3.org/2000/svg' width='640px' height='144px'>
    <foreignObject width='640px' height='144px' requiredExtensions="http://www.w3.org/1999/xhtml">
        <style>${style}</style>
        <body xmlns="http://www.w3.org/1999/xhtml" class="h-full w-full">
            <div class="antialiased font-sans bg-white dark:bg-gray-900 dark:text-gray-100 w-full h-full p-4 rounded-md border-gray-800 border flex space-x-6">
                <div class="flex-shrink-0 flex items-center justify-center">
                    <div class="bg-cover bg-center w-16 h-16 border rounded-md border-gray-600 border-opacity-50" style="background-image: url(${icon})" />
                </div>
                <div class="flex-grow w-64 flex flex-col justify-center space-y-1">
                    <h1 class="truncate text-xl">${title || ""}</h1>
                    <a class="truncate text-sm text-blue-400 hover:underline block" href="${url}" target="_blank">${url}</a>
                    <p class="truncate text-gray-800 dark:text-gray-200">${
                      description || ""
                    }</p>
                    <p class="truncate text-sm text-gray-600 dark:text-gray-400">${
                      provider || ""
                    }</p>
                </div>
            </div>
        </body>
    </foreignObject>
</svg>
`.trim()
}
