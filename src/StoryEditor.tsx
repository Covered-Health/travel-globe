import {
  BlockTypeSelect, BoldItalicUnderlineToggles, CreateLink, headingsPlugin, linkDialogPlugin,
  linkPlugin, listsPlugin, ListsToggle, markdownShortcutPlugin, MDXEditor, quotePlugin,
  toolbarPlugin, UndoRedo,
} from '@mdxeditor/editor'
import { Box, Typography } from '@mui/material'
import '@mdxeditor/editor/style.css'

export default function StoryEditor({ onChange }: { onChange: (markdown: string) => void }) {
  return <Box className="story-editor">
    <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>Story</Typography>
    <MDXEditor markdown="" onChange={onChange} placeholder="What made this place memorable?" plugins={[
      headingsPlugin(), listsPlugin(), quotePlugin(), linkPlugin(), linkDialogPlugin(), markdownShortcutPlugin(),
      toolbarPlugin({ toolbarContents: () => <><UndoRedo /><BlockTypeSelect /><BoldItalicUnderlineToggles /><ListsToggle /><CreateLink /></> }),
    ]} />
  </Box>
}
