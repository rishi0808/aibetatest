import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

// Maximum number of boot attempts
const MAX_BOOT_ATTEMPTS = 3;
const BOOT_RETRY_DELAY = 2000; // 2 seconds

// Cleanup function to handle WebContainer teardown
async function cleanup(instance: WebContainer) {
  try {
    // Attempt to gracefully shutdown any running processes
    const processes = await instance.fs.readdir('/');
    for (const process of processes) {
      try {
        await instance.spawn('pkill', ['-f', process]);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  } catch (e) {
    console.warn('Error during WebContainer cleanup:', e);
  }
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Boot function with retry logic
async function bootWebContainer(attempt = 1): Promise<WebContainer> {
  try {
    const instance = await WebContainer.boot({
      workdirName: WORK_DIR_NAME
    });

    // Test the instance by trying a simple operation
    await instance.fs.writeFile('/test.txt', 'test');
    await instance.fs.rm('/test.txt');

    return instance;
  } catch (error) {
    console.error(`WebContainer boot attempt ${attempt} failed:`, error);
    
    if (attempt >= MAX_BOOT_ATTEMPTS) {
      throw new Error(`Failed to boot WebContainer after ${MAX_BOOT_ATTEMPTS} attempts`);
    }

    // Wait before retrying
    await delay(BOOT_RETRY_DELAY);
    return bootWebContainer(attempt + 1);
  }
}

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(async () => {
        try {
          // Boot with retry logic
          const instance = await bootWebContainer();

          // Set up garbage collection interval
          const gcInterval = setInterval(() => {
            if (typeof global.gc === 'function') {
              global.gc();
            }
          }, 30000); // Run GC every 30 seconds

          // Handle hot module replacement cleanup
          if (import.meta.hot) {
            import.meta.hot.dispose(async () => {
              clearInterval(gcInterval);
              await cleanup(instance);
            });
          }

          // Add global error handler for out of memory errors
          window.addEventListener('unhandledrejection', async (event) => {
            if (event.reason instanceof Error && 
                event.reason.message.includes('Out of memory')) {
              console.error('WebContainer out of memory error detected');
              clearInterval(gcInterval);
              await cleanup(instance);
              // Force reload the page to reset the WebContainer state
              window.location.reload();
            }
          });

          // Initialize the file system with a basic structure
          await instance.fs.mkdir('/workspace');
          await instance.mount({
            '/workspace': {
              'package.json': {
                file: {
                  contents: JSON.stringify({
                    name: 'workspace',
                    type: 'module',
                    dependencies: {}
                  }, null, 2)
                }
              }
            }
          });

          return instance;
        } catch (error) {
          console.error('Failed to boot WebContainer:', error);
          throw error;
        }
      })
      .then((webcontainer) => {
        webcontainerContext.loaded = true;
        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
